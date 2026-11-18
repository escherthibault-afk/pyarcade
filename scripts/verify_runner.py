"""Python side of `npm run verify-content`.

Reads a JSON list of jobs on stdin (built by verify-content.ts from the YAML levels),
runs them with the SAME runner as the browser (src/python/runner.py) and prints a JSON report.
"""

import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.path.join(HERE, "..", "src", "python")
sys.path.insert(0, os.path.join(PY, "shims"))
sys.path.insert(0, PY)

import runner  # noqa: E402

STAT_SEEDS = list(range(1, 21))


def fail_summary(results):
    out = []
    for r in results:
        if not r.get("passed"):
            err = r.get("error") or {}
            msg = f"{r.get('call')} -> got {r.get('got')!s:.80} expected {r.get('expected') or r.get('expected_output')!s:.80}"
            if r.get("reason"):
                msg += f" [{r['reason']}]"
            if err:
                msg += f" [{err.get('type')}: {err.get('message')!s:.120} line {err.get('line')}]"
            out.append(msg)
    return out


def run_suite(code, job, tests, statistical, seeds=None, starter=False):
    return runner.cmd_run_tests(
        {
            "stop_on_fail": starter,
            "code": code,
            "files": job.get("files"),
            "given_code": job.get("given_code", ""),
            "tests": tests,
            "seed": job.get("seed"),
            "statistical": statistical,
            "stat_seeds": seeds,
            "timeout_ms": 2000 if starter else job.get("timeout_ms", 8000),
        }
    )


def flaky_check(code, job, tests):
    """Random-dependent tests must pass whatever the random state: rerun them with other seeds."""
    if "random" not in code:
        return []
    errors = []
    for seed in (101, 202, 303):
        runner.random.seed(seed)
        again = run_suite(code, job, tests, [], [1])
        if not again["load"]["error"]:
            errors += [f"flaky test (random state {seed}): {m}" for m in fail_summary(again["results"])]
    return errors[:3]


def check_code(job):
    errors = []
    tests = job["tests"]
    res = run_suite(job["solution"], job, tests, job.get("statistical", []), STAT_SEEDS)
    errors += flaky_check(job["solution"] + job.get("given_code", ""), job, tests)
    if res["load"]["error"]:
        e = res["load"]["error"]
        return [f"solution does not load: {e['type']}: {e['message']} (line {e['line']})"]
    errors += [f"solution fails: {m}" for m in fail_summary(res["results"])]
    for c in job.get("constraints", []):
        v = runner.check_constraints(job["solution"], c)
        if v:
            errors.append(f"solution violates constraints: {v}")
    if not tests and not job.get("statistical"):
        errors.append("no tests")
    # the starter must fail at least one test (or a constraint)
    st = run_suite(job["starter"], job, tests, job.get("statistical", []), [1], starter=True)
    starter_fails = bool(st["load"]["error"]) or any(not r.get("passed") for r in st["results"])
    # a constraint the starter breaks counts as a failed check (golf, refactor...)
    starter_fails = starter_fails or any(runner.check_constraints(job["starter"], c) for c in job.get("constraints", []))
    if not starter_fails:
        errors.append("starter_code passes every test (tests are too weak)")
    return errors


def check_boss(job):
    errors = []
    all_tests = [t for s in job["steps"] for t in s["tests"]]
    all_stats = [t for s in job["steps"] for t in s.get("statistical", [])]
    res = run_suite(job["solution"], job, all_tests, all_stats, STAT_SEEDS)
    if res["load"]["error"]:
        e = res["load"]["error"]
        return [f"boss solution does not load: {e['type']}: {e['message']} (line {e['line']})"]
    errors += flaky_check(job["solution"], job, all_tests)
    errors += [f"solution fails: {m}" for m in fail_summary(res["results"])]
    for s in job["steps"]:
        if s.get("constraints"):
            v = runner.check_constraints(job["solution"], s["constraints"])
            if v:
                errors.append(f"{s['fn']}: solution violates constraints: {v}")
        if not s["tests"] and not s.get("statistical"):
            errors.append(f"{s['fn']}: no tests")
    st = run_suite(job["starter"], job, all_tests, all_stats, [1])
    if st["load"]["error"]:
        e = st["load"]["error"]
        errors.append(f"boss starter does not load: {e['type']}: {e['message']} (line {e['line']})")
        return errors
    by_fn = {}
    for r in st["results"]:
        by_fn.setdefault(r.get("fn"), []).append(r["passed"])
    for s in job["steps"]:
        if all(by_fn.get(s["fn"], [True])):
            errors.append(f"{s['fn']}: starter passes every test of this function")
    return errors


def norm(s):
    return runner._norm_out(s)


def check_predict(job):
    r = runner.cmd_exec({"code": job["code"], "stdin": job.get("stdin", []), "files": job.get("files")})
    if r["error"]:
        return [f"code raises {r['error']['type']}: {r['error']['message']}"]
    if norm(r["stdout"]) != norm(job["answer"]):
        return [f"answer mismatch. real output:\n{r['stdout']}"]
    return []


def check_lesson(job):
    errors = []
    r = runner.cmd_exec({"code": job["example_code"], "stdin": job.get("stdin", []), "files": job.get("files")})
    if r["error"]:
        errors.append(f"example raises {r['error']['type']}: {r['error']['message']}")
    if job.get("expected_output") is not None:
        if not job.get("solution"):
            errors.append("expected_output without solution")
        else:
            s = runner.cmd_exec({"code": job["solution"], "stdin": job.get("stdin", []), "files": job.get("files")})
            if norm(s["stdout"]) != norm(job["expected_output"]):
                errors.append(f"solution output differs from expected_output: {s['stdout']!r} {s['error']}")
        if not r["error"] and norm(r["stdout"]) == norm(job["expected_output"]):
            errors.append("example already produces expected_output (nothing to change)")
    return errors


def check_parsons(job):
    code = "\n".join(job["lines"]) + "\n"
    if job.get("tests"):
        res = run_suite(code, job, job["tests"], [], [1])
        if res["load"]["error"]:
            return [f"parsons program does not load: {res['load']['error']}"]
        return [f"parsons fails: {m}" for m in fail_summary(res["results"])]
    r = runner.cmd_check({"code": code})
    if r["syntax"]:
        return [f"parsons syntax error: {r['syntax']['message']}"]
    return []


def check_trace(job):
    r = runner.cmd_trace({"code": job["code"], "watch": job["watch"], "max_rows": job.get("max_rows", 12)})
    if r["error"]:
        return [f"trace code raises {r['error']['type']}: {r['error']['message']}"]
    if not r["rows"]:
        return ["trace produced no rows (missing # @snap?)"]
    if r["truncated"]:
        return [f"trace has more than max_rows rows"]
    return []


def check_truth(job):
    r = runner.cmd_truth({"expr": job["solution"], "rows": job["rows"]})
    if not r["ok"]:
        return [f"truth solution error: {r['error']}"]
    if len(set(map(str, r["values"]))) < 2:
        return ["truth table is constant (useless)"]
    return []


def check_robot(job):
    errors = []
    r = runner.cmd_robot({"code": job["solution"], "grids": job["grids"], "max_steps": job.get("max_steps", 500)})
    for i, res in enumerate(r["results"]):
        if not res["success"]:
            errors.append(f"robot solution fails on grid {i}: {res['reason']} {res['error']}")
    s = runner.cmd_robot({"code": job["starter"], "grids": job["grids"], "max_steps": job.get("max_steps", 500)})
    if s["success"]:
        errors.append("robot starter already solves every grid")
    for c in job.get("constraints", []):
        v = runner.check_constraints(job["solution"], c)
        if v:
            errors.append(f"robot solution violates constraints: {v}")
    return errors


def check_write_test(job):
    errors = []
    impls = job["impls"]
    r = runner.cmd_write_test({"code": job["solution"], "impls": impls})
    if not r["ok"]:
        return [f"write_test solution error: {r['error']}"]
    for impl, res in zip(impls, r["results"]):
        if impl["correct"] and not res["passed"]:
            errors.append(f"reference asserts reject the correct impl '{impl['label']}': {res['failure']}")
        if not impl["correct"] and res["passed"]:
            errors.append(f"reference asserts do not kill wrong impl '{impl['label']}'")
    s = runner.cmd_write_test({"code": job["starter"], "impls": impls})
    if s["ok"]:
        killed_all = all((not res["passed"]) == (not impl["correct"]) for impl, res in zip(impls, s["results"]))
        if killed_all:
            errors.append("starter asserts already solve the level")
    return errors


def check_simulation(job):
    errors = check_code(job)
    load = runner.cmd_load({"code": job["solution"], "files": job.get("files"), "given_code": job.get("given_code", ""), "ns": "_sim"})
    if load["error"]:
        return errors
    params = {p["name"]: p["default"] for p in job.get("params", [])}
    r = runner.cmd_call({"ns": "_sim", "exec": "\n".join(f"{k} = {v!r}" for k, v in params.items()) + "\n" + job["driver"], "expr": "None"})
    if not r["ok"]:
        errors.append(f"simulation driver error: {r['error']['type']}: {r['error']['message']}")
    else:
        ns = runner.NAMESPACES["_sim"]
        if "frames" not in ns and "curve" not in ns:
            errors.append("simulation driver must define `frames` or `curve`")
    return errors


CHECKS = {
    "code": check_code,
    "boss": check_boss,
    "predict": check_predict,
    "lesson": check_lesson,
    "parsons": check_parsons,
    "trace": check_trace,
    "truth": check_truth,
    "robot": check_robot,
    "write_test": check_write_test,
    "simulation": check_simulation,
}


def main():
    if len(sys.argv) >= 3:
        with open(sys.argv[1], encoding="utf-8") as f:
            jobs = json.load(f)
    else:
        jobs = json.load(sys.stdin)
    report = {}
    start = os.getcwd()
    with tempfile.TemporaryDirectory() as tmp:
        for job in jobs:
            work = os.path.join(tmp, job["id"])
            os.makedirs(work, exist_ok=True)
            os.chdir(work)
            try:
                errors = CHECKS[job["kind"]](job)
            except BaseException as exc:  # noqa: BLE001
                errors = [f"verifier crashed: {type(exc).__name__}: {exc}"]
            finally:
                os.chdir(start)
            report[job["id"]] = errors
    out = json.dumps(report, ensure_ascii=False)
    if len(sys.argv) >= 3:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(out)
    else:
        sys.stdout.write(out)


if __name__ == "__main__":
    main()
