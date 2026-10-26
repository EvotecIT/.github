# Shared .NET SDK setup

Use this small action entrypoint to set up .NET without aka.ms redirects or
setup-dotnet's preliminary floating LTS runtime download.

```yaml
- uses: actions/checkout@v7
- uses: EvotecIT/.github/actions/setup-dotnet@main
  with:
    dotnet-version: |
      8.0.x
      10.0.x
```

Pin an immutable commit in workflows that pin their actions. Supported inputs
are `dotnet-version`, `global-json-file`, `dotnet-quality` and `architecture`;
outputs are `dotnet-version` and `dotnet-root`.

SDK resolution and installation remain in
[PowerForge's canonical setup action](https://github.com/EvotecIT/PSPublishModule/tree/main/.github/actions/setup-dotnet).
This repository only delivers its two runtime files. `source.json` pins their
PowerForge source commit and SHA-256 hashes, verified before either file runs.
The small entrypoint avoids downloading the entire PowerForge repository for
each setup step. No source checkout is added to the caller's workspace.

PowerForge reuses compatible installed SDKs or installs exact versions with
Microsoft's pinned installer and the official builds.dotnet.microsoft.com feed.
Other SDKs and runtimes stay available in a writable installation; macOS can
use the normal user-owned ~/.dotnet directory. Installed SDKs persist on our
self-hosted runners. No SDK archives are uploaded to GitHub's cache service.

To update the payload, merge and qualify the PowerForge change first, then
update the source commit and both hashes here together. Keep installer behavior
in PowerForge; this entrypoint should stay a small verified loader.

Run its focused delivery tests with:

```sh
node --test actions/setup-dotnet/bootstrap.test.cjs
```
