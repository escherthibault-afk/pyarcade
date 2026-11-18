"""PyArcade runner: executes student code, tests and constraints.

Shared by the browser (Pyodide web worker) and `npm run verify-content` (CPython),
so a level that passes verification behaves the same way on the site.

Single entry point: ``handle(request_json) -> response_json``.
"""

import ast
import base64
import builtins
import contextlib
import copy
import io
import json
import math
import numbers
import os
import random
import sys
import time
import traceback
import warnings

os.environ.setdefault("MPLBACKEND", "Agg")
warnings.filterwarnings("ignore", message=".*non-interactive.*")
warnings.filterwarnings("ignore", message=".*Matplotlib is currently using agg.*")

STUDENT = "<ton_code>"
GIVEN = "<code_fourni>"
MAX_OUT = 60_000
IN_BROWSER = sys.platform == "emscripten"

_real_sleep = time.sleep


class NeedInput(BaseException):
    """Raised by input() in interactive mode when no more lines are queued."""

    def __init__(self, prompt=""):
        super().__init__(prompt)
        self.prompt = prompt


class NeedKey(BaseException):
    """Raised by readchar_lite.readkey() when no more keys are queued."""


class TestTimeout(BaseException):
    pass


# ---------------------------------------------------------------- helpers


class _Out(io.StringIO):
    """stdout capture with a size cap (protects against print in an infinite loop)."""

    def write(self, s):
        if self.tell() < MAX_OUT:
            return super().write(s)
        return len(s)


def _short_repr(value, limit=400):
    try:
        r = repr(value)
    except Exception as exc:  # pragma: no cover
        r = f"<repr impossible: {exc}>"
    if len(r) > limit:
        r = r[: limit - 3] + "..."
    return r


def _jsonable(value, depth=0):
    if depth > 6:
        return _short_repr(value)
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return repr(value)
        return value
    if isinstance(value, (list, tuple)):
        return [_jsonable(v, depth + 1) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v, depth + 1) for k, v in value.items()}
    if isinstance(value, set):
        return [_jsonable(v, depth + 1) for v in sorted(value, key=repr)]
    return _short_repr(value)


def _shims():
    mods = {}
    for name in ("canvas", "rich_lite", "readchar_lite", "folium_lite"):
        try:
            mods[name] = __import__(name)
        except Exception:  # pragma: no cover - shims always available in practice
            pass
    return mods


def _reset_shims():
    for mod in _shims().values():
        reset = getattr(mod, "_reset", None)
        if reset:
            reset()


def _write_files(files):
    for name, content in (files or {}).items():
        folder = os.path.dirname(name)
        if folder:
            os.makedirs(folder, exist_ok=True)
        with open(name, "w", encoding="utf-8") as f:
            f.write(content)


def _make_input(lines, interactive):
    queue = list(lines or [])

    def fake_input(prompt=""):
        if queue:
            value = queue.pop(0)
            if interactive:
                sys.stdout.write(f"{prompt}{value}\n")
            return value
        if interactive:
            raise NeedInput(str(prompt))
        raise EOFError("input() : plus aucune ligne à lire")

    return fake_input


def _new_namespace(name, stdin, interactive=False):
    ns = {"__name__": name, "__builtins__": builtins}
    ns["input"] = _make_input(stdin, interactive)
    return ns


@contextlib.contextmanager
def _capture():
    out = _Out()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = out
    sys.stderr = out
    time.sleep = lambda s=0: None
    try:
        yield out
    finally:
        sys.stdout, sys.stderr = old_out, old_err
        time.sleep = _real_sleep


@contextlib.contextmanager
def _time_limit(ms):
    """Hard per-test timeout for CPython (verify-content). The browser kills the worker instead."""
    if IN_BROWSER or not ms or not hasattr(__import__("signal"), "setitimer"):
        yield
        return
    import signal

    def on_alarm(signum, frame):
        raise TestTimeout()

    old = signal.signal(signal.SIGALRM, on_alarm)
    signal.setitimer(signal.ITIMER_REAL, ms / 1000)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old)


# ---------------------------------------------------------------- errors


def _code_line(code, lineno):
    if not code or not lineno:
        return ""
    lines = code.splitlines()
    if 1 <= lineno <= len(lines):
        return lines[lineno - 1]
    return ""


SAFE_CALLS = {"len", "abs", "int", "min", "max"}


def _has_call(node):
    """True if evaluating `node` could have side effects (calls other than len/abs/int/min/max)."""
    for n in ast.walk(node):
        if isinstance(n, (ast.Await, ast.Yield, ast.NamedExpr)):
            return True
        if isinstance(n, ast.Call) and not (isinstance(n.func, ast.Name) and n.func.id in SAFE_CALLS):
            return True
    return False


def _enrich(exc, frame, line_text):
    """Extra facts for the French explanation (index vs length, missing key...)."""
    detail = {}
    if frame is None or not line_text.strip():
        return detail
    s = line_text.strip()
    if s.startswith("elif "):
        s = s[2:]
    if s.endswith(":"):
        s += " pass"
    try:
        tree = ast.parse(s)
    except SyntaxError:
        return detail
    env = dict(frame.f_globals)
    env.update(frame.f_locals)
    for node in ast.walk(tree):
        if not isinstance(node, ast.Subscript) or isinstance(node.slice, ast.Slice):
            continue
        if _has_call(node.value) or _has_call(node.slice):
            continue
        try:
            container = eval(compile(ast.Expression(node.value), "<e>", "eval"), {"__builtins__": builtins}, env)
            key = eval(compile(ast.Expression(node.slice), "<e>", "eval"), {"__builtins__": builtins}, env)
        except BaseException:
            continue
        expr = ast.unparse(node)
        if isinstance(exc, IndexError) and isinstance(container, (list, tuple, str)) and isinstance(key, int):
            n = len(container)
            if key >= n or key < -n:
                detail.update(expr=expr, index=key, length=n, container=type(container).__name__)
                break
        if isinstance(exc, KeyError) and isinstance(container, dict):
            try:
                missing = key not in container
            except TypeError:
                missing = False
            if missing:
                keys = [repr(k) for k in list(container)[:8]]
                detail.update(expr=expr, key=repr(key), keys=keys)
                break
    return detail


def error_info(exc, code="", filename=STUDENT, line_offset=0):
    etype = type(exc).__name__
    if isinstance(exc, TestTimeout):
        return {"type": "Timeout", "message": "", "line": None, "line_text": "", "detail": {}, "trace": ""}
    if isinstance(exc, SyntaxError):
        line = exc.lineno if exc.filename == filename else None
        if line is not None:
            line -= line_offset
        return {
            "type": etype,
            "message": exc.msg,
            "line": line,
            "line_text": _code_line(code, line) if line else (exc.text or "").rstrip(),
            "offset": exc.offset,
            "detail": {},
            "trace": "",
        }
    message = str(exc)
    if isinstance(exc, KeyError) and exc.args:
        message = repr(exc.args[0])
    line = None
    student_frame = None
    tb = exc.__traceback__
    trace_lines = []
    while tb is not None:
        f = tb.tb_frame
        if f.f_code.co_filename == filename:
            line = tb.tb_lineno - line_offset
            student_frame = f
            trace_lines.append(f"  ligne {line}, dans {f.f_code.co_name if f.f_code.co_name != '<module>' else 'le programme'}")
        tb = tb.tb_next
    line_text = _code_line(code, line)
    detail = {}
    try:
        detail = _enrich(exc, student_frame, line_text)
    except Exception:
        detail = {}
    if isinstance(exc, NameError) and getattr(exc, "name", None):
        detail["name"] = exc.name
    if isinstance(exc, AttributeError) and getattr(exc, "name", None):
        detail["name"] = exc.name
    if isinstance(exc, RecursionError):
        trace_lines = trace_lines[:3] + ["  ..."] + trace_lines[-2:] if len(trace_lines) > 6 else trace_lines
    trace = "\n".join(trace_lines[-8:] + [f"{etype}: {message}"])
    return {"type": etype, "message": message, "line": line, "line_text": line_text, "detail": detail, "trace": trace}


# ---------------------------------------------------------------- execution


def _compile_student(code):
    return compile(code, STUDENT, "exec")


def _exec_program(code, ns, given_code=""):
    if given_code:
        exec(compile(given_code, GIVEN, "exec"), ns)
    exec(_compile_student(code), ns)


def _collect_media():
    media = {}
    if "matplotlib.pyplot" in sys.modules:
        plt = sys.modules["matplotlib.pyplot"]
        images = []
        for num in plt.get_fignums():
            fig = plt.figure(num)
            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=90, bbox_inches="tight")
            images.append(base64.b64encode(buf.getvalue()).decode("ascii"))
        plt.close("all")
        if images:
            media["images"] = images
    shims = _shims()
    cv = shims.get("canvas")
    if cv is not None:
        frame = cv._take()
        if frame:
            media["canvas"] = {"width": cv.WIDTH, "height": cv.HEIGHT, "frame": frame}
        if cv._frame_cb is not None:
            media.setdefault("canvas", {"width": cv.WIDTH, "height": cv.HEIGHT, "frame": []})
            media["canvas"]["animated"] = True
    fol = shims.get("folium_lite")
    if fol is not None and fol._maps:
        media["maps"] = [m._to_json() for m in fol._maps]
    return media


NAMESPACES = {}


def cmd_exec(req):
    """Run a whole program. Supports interactive replay (inputs/keys queues)."""
    _reset_shims()
    _write_files(req.get("files"))
    code = req.get("code", "")
    seed = req.get("seed")
    if seed is not None:
        random.seed(seed)
    rl = _shims().get("readchar_lite")
    if rl is not None:
        rl._queue[:] = list(req.get("keys") or [])
    interactive = bool(req.get("interactive"))
    ns = _new_namespace("__main__", req.get("stdin") or req.get("inputs") or [], interactive)
    needs = None
    prompt = ""
    error = None
    with _capture() as out:
        try:
            _exec_program(code, ns, req.get("given_code", ""))
        except NeedInput as exc:
            needs, prompt = "input", exc.prompt
        except NeedKey:
            needs = "key"
        except SystemExit:
            pass
        except BaseException as exc:  # noqa: BLE001 - we report everything to the student
            error = error_info(exc, code)
    if req.get("keep"):
        NAMESPACES[req["keep"]] = ns
    res = {"ok": error is None, "stdout": out.getvalue(), "error": error, "needs": needs, "prompt": prompt}
    try:
        res.update(_collect_media())
    except Exception as exc:  # pragma: no cover
        res["media_error"] = str(exc)
    return res


def cmd_load(req):
    """Exec the student's code in a fresh named namespace, for later tests/calls."""
    _reset_shims()
    _write_files(req.get("files"))
    code = req.get("code", "")
    ns = _new_namespace(req.get("name", "student"), [])
    error = None
    with _capture() as out:
        try:
            _exec_program(code, ns, req.get("given_code", ""))
        except (NeedInput, NeedKey):
            error = {"type": "TopLevelInput", "message": "", "line": None, "line_text": "", "detail": {}, "trace": ""}
        except SystemExit:
            pass
        except BaseException as exc:  # noqa: BLE001
            error = error_info(exc, code)
    NAMESPACES[req.get("ns", "level")] = ns
    return {"ok": error is None, "stdout": out.getvalue(), "error": error}


# ---------------------------------------------------------------- comparison


def compare(got, exp, tol=None, path="résultat"):
    """Smart comparison. Returns (ok, reason, where)."""
    rel = abs_ = 1e-9 if tol is None else tol
    if isinstance(exp, bool) or isinstance(got, bool):
        if type(got) is not type(exp):
            return False, "type", path
        return got == exp, None, path
    if isinstance(exp, float) and isinstance(got, numbers.Real):
        if math.isnan(exp) and isinstance(got, float) and math.isnan(got):
            return True, None, path
        return math.isclose(got, exp, rel_tol=rel, abs_tol=abs_), ("float" if got != exp else None), path
    if isinstance(exp, int) and isinstance(got, numbers.Real) and not isinstance(got, numbers.Integral):
        if got == exp:
            return False, "float_vs_int", path
        return False, None, path
    if isinstance(exp, int) and isinstance(got, numbers.Integral):
        return int(got) == exp, None, path
    if isinstance(exp, (list, tuple)):
        if not isinstance(got, (list, tuple)):
            return False, "type", path
        if type(got) is not type(exp):
            return False, "list_vs_tuple", path
        if len(got) != len(exp):
            return False, "length", path
        for i, (g, e) in enumerate(zip(got, exp)):
            ok, reason, where = compare(g, e, tol, f"{path}[{i}]")
            if not ok:
                return False, reason, where
        return True, None, path
    if isinstance(exp, dict):
        if not isinstance(got, dict):
            return False, "type", path
        if set(got) != set(exp):
            return False, "keys", path
        for k in exp:
            ok, reason, where = compare(got[k], exp[k], tol, f"{path}[{k!r}]")
            if not ok:
                return False, reason, where
        return True, None, path
    if type(exp) is not type(got) and not (isinstance(exp, (int, float)) and isinstance(got, (int, float))):
        if exp is not None and got is not None and type(exp).__name__ != type(got).__name__:
            return False, "type", path
    try:
        return bool(got == exp), None, path
    except Exception:
        return False, None, path


def _norm_out(s):
    lines = [ln.rstrip() for ln in s.replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def _eval_expected(expr):
    env = {"__builtins__": builtins, "math": math, "inf": math.inf, "nan": math.nan}
    return eval(expr, env)


def _split_call(call_src, ns):
    """For purity checks: evaluate function and arguments separately."""
    node = ast.parse(call_src, mode="eval").body
    if not isinstance(node, ast.Call):
        return None
    func = eval(compile(ast.Expression(node.func), "<call>", "eval"), ns)
    args = [eval(compile(ast.Expression(a), "<call>", "eval"), ns) for a in node.args if not isinstance(a, ast.Starred)]
    kwargs = {
        kw.arg: eval(compile(ast.Expression(kw.value), "<call>", "eval"), ns) for kw in node.keywords if kw.arg
    }
    return func, args, kwargs


def run_test(test, ns, code, seed=None, given_code="", files=None, timeout_ms=None):
    res = {
        "call": test.get("call") or "(programme complet)",
        "label": test.get("label"),
        "fn": test.get("fn"),
        "passed": False,
        "stdout": "",
        "error": None,
        "reason": None,
    }
    if test.get("stdin"):
        res["stdin"] = test["stdin"]
    expected = None
    has_expected = test.get("expected") is not None
    if has_expected:
        try:
            expected = _eval_expected(test["expected"])
        except Exception as exc:
            res["error"] = {"type": "BadTest", "message": f"expected invalide: {exc}", "line": None, "line_text": "", "detail": {}, "trace": ""}
            return res
        res["expected"] = _short_repr(expected)
    if test.get("output") is not None:
        res["expected_output"] = test["output"]
    got = None
    raised = None
    mutated = None
    with _capture() as out:
        try:
            with _time_limit(timeout_ms):
                if seed is not None:
                    random.seed(seed)
                if test.get("script"):
                    _reset_shims()
                    _write_files(files)
                    sns = _new_namespace("__main__", test.get("stdin") or [])
                    _exec_program(code, sns, given_code)
                    if test.get("call"):
                        got = eval(test["call"], sns)
                else:
                    if test.get("stdin"):
                        ns["input"] = _make_input(test["stdin"], False)
                    if test.get("setup"):
                        exec(test["setup"], ns)
                    if test.get("pure"):
                        parts = _split_call(test["call"], ns)
                        if parts is None:
                            got = eval(test["call"], ns)
                        else:
                            func, args, kwargs = parts
                            before = copy.deepcopy((args, kwargs))
                            got = func(*args, **kwargs)
                            if before != (args, kwargs):
                                mutated = True
                    else:
                        got = eval(test["call"], ns)
        except TestTimeout as exc:
            raised = exc
        except (NeedInput, NeedKey):
            raised = EOFError("input() / readkey() appelé mais aucune entrée n'est prévue pour ce test")
        except BaseException as exc:  # noqa: BLE001
            raised = exc
    stdout = out.getvalue()
    res["stdout"] = stdout
    if isinstance(raised, TestTimeout):
        res["error"] = error_info(raised, code)
        res["reason"] = "timeout"
        return res
    if test.get("raises"):
        if raised is not None and type(raised).__name__ == test["raises"]:
            res["passed"] = True
            res["got"] = f"{type(raised).__name__} levée ✔"
        elif raised is not None:
            res["error"] = error_info(raised, code)
            res["got"] = f"{type(raised).__name__}"
            res["reason"] = "wrong_exception"
        else:
            res["got"] = _short_repr(got)
            res["reason"] = "no_exception"
        res["expected"] = f"{test['raises']} levée"
        return res
    if raised is not None:
        res["error"] = error_info(raised, code)
        return res
    res["got"] = _short_repr(got)
    ok = True
    if has_expected:
        ok, reason, where = compare(got, expected, test.get("tol"))
        if not ok:
            if got is None and expected is not None:
                reason = "print_not_return" if stdout.strip() else "returned_none"
            res["reason"] = reason
            if where != "résultat":
                res["where"] = where
    if ok and test.get("output") is not None:
        if _norm_out(stdout) != _norm_out(test["output"]):
            ok = False
            res["reason"] = "wrong_output"
    if ok and mutated:
        ok = False
        res["reason"] = "mutated_args"
    res["passed"] = ok
    return res


def cmd_test(req):
    ns = NAMESPACES.get(req.get("ns", "level"))
    if ns is None:
        if not req["test"].get("script"):
            return {"call": req["test"].get("call"), "passed": False, "stdout": "", "reason": None,
                    "error": {"type": "NoNamespace", "message": "code not loaded", "line": None, "line_text": "", "detail": {}, "trace": ""}}
        ns = {}
    return run_test(
        req["test"], ns, req.get("code", ""), req.get("seed"), req.get("given_code", ""), req.get("files"), req.get("timeout_ms")
    )


def cmd_stat(req):
    """One statistical test: evaluates `expr` (several seeds in verify-content)."""
    ns = NAMESPACES.get(req.get("ns", "level"))
    st = req["stat"]
    res = {"call": st["expr"], "label": st.get("label"), "fn": st.get("fn"), "passed": False, "stat": True}
    res["expected"] = f"≈ {st['approx']} (± {st['tol']})"
    seeds = req.get("seeds") or [None]
    values = []
    with _capture() as out:
        try:
            for s in seeds:
                if s is not None:
                    random.seed(s)
                else:
                    random.seed()
                values.append(eval(st["expr"], ns))
        except BaseException as exc:  # noqa: BLE001
            res["error"] = error_info(exc, req.get("code", ""))
            res["stdout"] = out.getvalue()
            return res
    res["stdout"] = out.getvalue()
    bad = [v for v in values if not isinstance(v, (int, float)) or abs(v - st["approx"]) > st["tol"]]
    res["got"] = _short_repr(values[0] if len(values) == 1 else values)
    res["passed"] = not bad
    if bad:
        res["reason"] = "stat"
    return res


def cmd_run_tests(req):
    """Load + all tests in one go (verify-content, simple callers)."""
    code = req.get("code", "")
    tests = req.get("tests", [])
    if tests and all(t.get("script") for t in tests) and not req.get("statistical"):
        # whole-program tests: each one runs the program in its own namespace
        NAMESPACES["_rt"] = _new_namespace("student", [])
        load = {"ok": True, "stdout": "", "error": None}
    else:
        load = cmd_load({"code": code, "files": req.get("files"), "given_code": req.get("given_code", ""), "ns": "_rt"})
    results = []
    if load["error"]:
        return {"load": load, "results": results}
    for t in req.get("tests", []):
        ns = NAMESPACES["_rt"]
        results.append(
            run_test(t, ns, code, req.get("seed"), req.get("given_code", ""), req.get("files"), req.get("timeout_ms", 5000))
        )
        if req.get("stop_on_fail") and not results[-1]["passed"]:
            return {"load": load, "results": results}
    for st in req.get("statistical", []):
        results.append(cmd_stat({"ns": "_rt", "stat": st, "code": code, "seeds": req.get("stat_seeds")}))
    return {"load": load, "results": results}


def cmd_call(req):
    """Evaluate an expression in a loaded namespace (live games)."""
    ns = NAMESPACES.get(req.get("ns", "level"))
    if ns is None:
        return {"ok": False, "error": {"type": "NoNamespace", "message": "", "line": None, "line_text": "", "detail": {}, "trace": ""}}
    if req.get("seed") is not None:
        random.seed(req["seed"])
    with _capture() as out:
        try:
            if req.get("exec"):
                exec(req["exec"], ns)
            value = eval(req["expr"], ns) if req.get("expr") else None
        except BaseException as exc:  # noqa: BLE001
            return {"ok": False, "error": error_info(exc, req.get("code", "")), "stdout": out.getvalue()}
    res = {"ok": True, "value": _jsonable(value), "repr": _short_repr(value), "stdout": out.getvalue()}
    if req.get("media"):
        res.update(_collect_media())
    return res


def cmd_frame(req):
    """Animation: call the canvas on_frame callback n times, return the last frame."""
    cv = _shims().get("canvas")
    if cv is None or cv._frame_cb is None:
        return {"ok": False, "error": None, "frame": []}
    with _capture() as out:
        try:
            for _ in range(max(1, req.get("n", 1))):
                cv._cmds.clear()
                cv._frame_cb()
        except BaseException as exc:  # noqa: BLE001
            return {"ok": False, "error": error_info(exc, req.get("code", "")), "stdout": out.getvalue(), "frame": []}
    return {"ok": True, "frame": cv._take(), "stdout": out.getvalue()}


# ---------------------------------------------------------------- AST constraints


def _docstring_lines(tree):
    lines = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = getattr(node, "body", [])
            if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None), ast.Constant):
                if isinstance(body[0].value.value, str):
                    lines.update(range(body[0].lineno, (body[0].end_lineno or body[0].lineno) + 1))
    return lines


def count_code_lines(code, tree=None):
    try:
        tree = tree or ast.parse(code)
        doc = _docstring_lines(tree)
    except SyntaxError:
        doc = set()
    n = 0
    for i, line in enumerate(code.splitlines(), start=1):
        s = line.strip()
        if s and not s.startswith("#") and i not in doc:
            n += 1
    return n


def _matches(node, rule):
    if rule.startswith("call:"):
        name = rule[5:]
        if isinstance(node, ast.Call):
            f = node.func
            return (isinstance(f, ast.Name) and f.id == name) or (isinstance(f, ast.Attribute) and f.attr == name)
        return False
    if rule.startswith("method:"):
        name = rule[7:]
        return isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == name
    if rule.startswith("import:"):
        name = rule[7:]
        if isinstance(node, ast.Import):
            return any(a.name.split(".")[0] == name for a in node.names)
        if isinstance(node, ast.ImportFrom):
            return (node.module or "").split(".")[0] == name
        return False
    if rule.startswith("name:"):
        return isinstance(node, ast.Name) and node.id == rule[5:]
    if rule == "Comprehension":
        return isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp))
    if rule == "Recursion":
        return False  # handled separately
    return type(node).__name__ == rule


def _is_recursive(fn):
    return any(
        isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == fn.name for n in ast.walk(fn)
    )


def check_constraints(code, constraints):
    violations = []
    if not constraints:
        return violations
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return violations  # reported by execution
    scope = tree
    scope_name = constraints.get("scope")
    if scope_name:
        found = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == scope_name]
        if not found:
            return [{"rule": "missing_function", "detail": scope_name}]
        scope = found[0]
    nodes = list(ast.walk(scope))
    for rule in constraints.get("required", []):
        if rule == "Recursion":
            ok = any(isinstance(n, ast.FunctionDef) and _is_recursive(n) for n in nodes)
        else:
            ok = any(_matches(n, rule) for n in nodes)
        if not ok:
            violations.append({"rule": "required", "detail": rule})
    for rule in constraints.get("forbidden", []):
        if rule == "Recursion":
            bad = any(isinstance(n, ast.FunctionDef) and _is_recursive(n) for n in nodes)
        else:
            bad = any(_matches(n, rule) for n in nodes)
        if bad:
            violations.append({"rule": "forbidden", "detail": rule})
    for rule, limit in (constraints.get("max_count") or {}).items():
        count = sum(1 for n in nodes if _matches(n, rule))
        if count > limit:
            violations.append({"rule": "max_count", "detail": rule, "limit": limit, "count": count})
    if constraints.get("max_lines"):
        src = ast.get_source_segment(code, scope) if scope is not tree else code
        n = count_code_lines(src or code)
        if n > constraints["max_lines"]:
            violations.append({"rule": "max_lines", "limit": constraints["max_lines"], "count": n})
    if constraints.get("max_chars"):
        n = len(code.strip())
        if n > constraints["max_chars"]:
            violations.append({"rule": "max_chars", "limit": constraints["max_chars"], "count": n})
    if scope_name:
        for v in violations:
            v["scope"] = scope_name
    return violations


def cmd_check(req):
    code = req.get("code", "")
    out = {"violations": [], "chars": len(code.strip()), "lines": count_code_lines(code), "syntax": None, "stubs": []}
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        out["syntax"] = error_info(exc, code)
        return out
    # functions whose body is still only a docstring + `pass` / `...`
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            body = [b for b in node.body if not (isinstance(b, ast.Expr) and isinstance(getattr(b, "value", None), ast.Constant) and isinstance(b.value.value, str))]
            if all(isinstance(b, ast.Pass) or (isinstance(b, ast.Expr) and isinstance(getattr(b, "value", None), ast.Constant) and b.value.value is Ellipsis) for b in body):
                out["stubs"].append(node.name)
    for c in req.get("constraints_list") or ([req["constraints"]] if req.get("constraints") else []):
        out["violations"].extend(check_constraints(code, c))
    return out


# ---------------------------------------------------------------- trace tables


def cmd_trace(req):
    code = req["code"]
    watch = req["watch"]
    max_rows = req.get("max_rows", 12)
    lines = code.splitlines()
    out_lines = []
    for line in lines:
        if "# @snap" in line:
            clean = line.split("# @snap")[0].rstrip()
            indent = clean[: len(clean) - len(clean.lstrip())]
            out_lines.append(clean)
            out_lines.append(f"{indent}__snap__(locals())")
        else:
            out_lines.append(line)
    rows = []

    def snap(env):
        if len(rows) < max_rows + 1:
            rows.append({w: (_short_repr(env[w], 60) if w in env else "—") for w in watch})

    ns = _new_namespace("__main__", req.get("stdin") or [])
    ns["__snap__"] = snap
    error = None
    with _capture() as out:
        try:
            exec(compile("\n".join(out_lines), STUDENT, "exec"), ns)
        except BaseException as exc:  # noqa: BLE001
            error = error_info(exc, code)
    return {"rows": rows[:max_rows], "truncated": len(rows) > max_rows, "stdout": out.getvalue(), "error": error}


# ---------------------------------------------------------------- truth tables


def cmd_truth(req):
    expr = req["expr"]
    rows = req["rows"]
    try:
        compiled = compile(expr, STUDENT, "eval")
    except SyntaxError as exc:
        return {"ok": False, "error": error_info(exc, expr)}
    values = []
    for row in rows:
        try:
            v = eval(compiled, {"__builtins__": builtins}, dict(row))
            values.append(bool(v) if isinstance(v, bool) else _jsonable(v))
        except BaseException as exc:  # noqa: BLE001
            return {"ok": False, "error": error_info(exc, expr)}
    return {"ok": True, "values": values}


# ---------------------------------------------------------------- robot


class RobotCrash(Exception):
    pass


class RobotTired(Exception):
    pass


DIRS = {"^": (0, -1), ">": (1, 0), "v": (0, 1), "<": (-1, 0)}
ORDER = ["^", ">", "v", "<"]


class RobotWorld:
    def __init__(self, grid, max_steps):
        self.grid = [list(row) for row in grid]
        self.max_steps = max_steps
        self.coins = set()
        self.goal = None
        for y, row in enumerate(self.grid):
            for x, c in enumerate(row):
                if c in DIRS:
                    self.x, self.y, self.d = x, y, c
                    row[x] = "."
                elif c == "G":
                    self.goal = (x, y)
                elif c == "*":
                    self.coins.add((x, y))
        self.picked = 0
        self.steps = 0
        self.actions = [[self.x, self.y, self.d, "start"]]

    def _tick(self):
        self.steps += 1
        if self.steps > self.max_steps:
            raise RobotTired()

    def _cell(self, x, y):
        if 0 <= y < len(self.grid) and 0 <= x < len(self.grid[y]):
            return self.grid[y][x]
        return "#"

    def wall_ahead(self):
        dx, dy = DIRS[self.d]
        return self._cell(self.x + dx, self.y + dy) == "#"

    def move(self):
        self._tick()
        if self.wall_ahead():
            self.actions.append([self.x, self.y, self.d, "crash"])
            raise RobotCrash()
        dx, dy = DIRS[self.d]
        self.x += dx
        self.y += dy
        self.actions.append([self.x, self.y, self.d, "move"])

    def turn_left(self):
        self._tick()
        self.d = ORDER[(ORDER.index(self.d) - 1) % 4]
        self.actions.append([self.x, self.y, self.d, "turn"])

    def turn_right(self):
        self._tick()
        self.d = ORDER[(ORDER.index(self.d) + 1) % 4]
        self.actions.append([self.x, self.y, self.d, "turn"])

    def at_goal(self):
        return (self.x, self.y) == self.goal

    def coin_here(self):
        return (self.x, self.y) in self.coins

    def pick_coin(self):
        self._tick()
        if (self.x, self.y) in self.coins:
            self.coins.discard((self.x, self.y))
            self.picked += 1
            self.actions.append([self.x, self.y, self.d, "coin"])


def cmd_robot(req):
    code = req["code"]
    results = []
    for grid in req["grids"]:
        world = RobotWorld(grid, req.get("max_steps", 500))
        ns = _new_namespace("__main__", [])
        for name in ("move", "turn_left", "turn_right", "wall_ahead", "at_goal", "coin_here", "pick_coin"):
            ns[name] = getattr(world, name)
        ns["front_is_clear"] = lambda: not world.wall_ahead()
        error = None
        reason = None
        with _capture() as out:
            try:
                with _time_limit(req.get("timeout_ms", 3000)):
                    exec(_compile_student(code), ns)
            except RobotCrash:
                reason = "crash"
            except RobotTired:
                reason = "tired"
            except TestTimeout:
                reason = "tired"
            except BaseException as exc:  # noqa: BLE001
                error = error_info(exc, code)
        success = error is None and reason is None and world.at_goal() and not world.coins
        if error is None and reason is None and not success:
            reason = "coins_left" if world.at_goal() else "not_at_goal"
        results.append(
            {"success": success, "reason": reason, "error": error, "actions": world.actions, "steps": world.steps, "stdout": out.getvalue()}
        )
    return {"results": results, "success": all(r["success"] for r in results)}


# ---------------------------------------------------------------- write the test


def cmd_write_test(req):
    asserts = req["code"]
    try:
        compiled = _compile_student(asserts)
    except SyntaxError as exc:
        return {"ok": False, "error": error_info(exc, asserts), "results": []}
    results = []
    for impl in req["impls"]:
        ns = _new_namespace("__main__", [])
        passed = True
        failure = None
        with _capture():
            try:
                exec(compile(impl["code"], GIVEN, "exec"), ns)
            except BaseException:  # noqa: BLE001
                pass
            try:
                with _time_limit(2000):
                    exec(compiled, ns)
            except AssertionError as exc:
                passed = False
                failure = error_info(exc, asserts)
            except BaseException as exc:  # noqa: BLE001
                passed = False
                failure = error_info(exc, asserts)
        results.append({"label": impl.get("label"), "passed": passed, "failure": failure})
    return {"ok": True, "results": results}


# ---------------------------------------------------------------- entry point

COMMANDS = {
    "exec": cmd_exec,
    "load": cmd_load,
    "test": cmd_test,
    "stat": cmd_stat,
    "run_tests": cmd_run_tests,
    "call": cmd_call,
    "frame": cmd_frame,
    "check": cmd_check,
    "trace": cmd_trace,
    "truth": cmd_truth,
    "robot": cmd_robot,
    "write_test": cmd_write_test,
}


def handle(request_json):
    req = json.loads(request_json)
    cmd = COMMANDS.get(req.get("cmd"))
    if cmd is None:
        return json.dumps({"fatal": f"unknown command {req.get('cmd')}"})
    try:
        result = cmd(req)
    except BaseException as exc:  # noqa: BLE001 - never crash the worker
        result = {"fatal": "".join(traceback.format_exception(exc))[-2000:]}
    return json.dumps(result, ensure_ascii=False, default=_short_repr)
