"""Prepare a distinct, local-only Supabase configuration for a CI job."""
import os
import re
import socket
import tomllib
from contextlib import ExitStack
from pathlib import Path


PORT_KEYS = {
    "api": ("port",),
    "db": ("port", "shadow_port"),
    "studio": ("port",),
    "local_smtp": ("port", "smtp_port", "pop3_port"),
    "edge_runtime": ("inspector_port",),
}


def isolated_config(source, project_id, ports):
    """Change only local container identity and local listener ports."""
    config = tomllib.loads(source)
    if not re.fullmatch(r"criclume-ci-[0-9]+-[0-9]+", project_id):
        raise ValueError("Invalid isolated CI project ID")
    expected = {(section, key) for section, keys in PORT_KEYS.items() for key in keys}
    if set(ports) != expected or len(set(ports.values())) != len(expected):
        raise ValueError("Expected a distinct port for each local listener")
    lines = source.splitlines()
    output = []
    section = None
    seen = set()
    replaced_project = False

    def append_missing():
        for key in PORT_KEYS.get(section, ()):
            if (section, key) not in seen:
                output.append(f"{key} = {ports[section, key]}")
                seen.add((section, key))

    for line in lines:
        heading = re.fullmatch(r"\s*\[([^\]]+)\]\s*(?:#.*)?", line)
        if heading:
            append_missing()
            section = heading.group(1)
            output.append(line)
            continue
        if section is None and re.match(r"^\s*project_id\s*=", line):
            output.append(f'project_id = "{project_id}"')
            replaced_project = True
            continue
        setting = re.match(r"^\s*([a-z_]+)\s*=", line)
        if setting and (section, setting.group(1)) in expected:
            key = setting.group(1)
            output.append(f"{key} = {ports[section, key]}")
            seen.add((section, key))
        else:
            output.append(line)
    append_missing()
    result = "\n".join(output) + "\n"
    parsed = tomllib.loads(result)
    if not replaced_project or parsed["project_id"] != project_id or seen != expected:
        raise ValueError("Unable to isolate the existing CI configuration")
    for (group, key), port in ports.items():
        if parsed[group][key] != port:
            raise ValueError("Port override did not take effect")
    # All other local configuration, including auth and function settings, must survive.
    config["project_id"] = project_id
    for (group, key), port in ports.items():
        config[group][key] = port
    if parsed != config:
        raise ValueError("Unexpected changes to local Supabase configuration")
    return result


def main():
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise SystemExit("This script only runs in the disposable GitHub Actions checkout")
    project_id = f"criclume-ci-{os.environ['GITHUB_RUN_ID']}-{os.environ['GITHUB_RUN_ATTEMPT']}"
    path = Path("supabase/config.toml")
    with ExitStack() as stack:
        ports = {}
        for group, keys in PORT_KEYS.items():
            for key in keys:
                sock = stack.enter_context(socket.socket())
                sock.bind(("0.0.0.0", 0))
                ports[group, key] = sock.getsockname()[1]
        path.write_text(isolated_config(path.read_text(), project_id, ports))
    print(f"Prepared isolated local project {project_id}")


if __name__ == "__main__":
    main()
