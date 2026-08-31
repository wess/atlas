$ErrorActionPreference = 'Stop'

# The version and checksum are placeholders in git and are rewritten per
# release by the workflow — see packaging/README.md. Chocolatey shims the
# executable from wherever it unzips.
$version = '0.0.0'
$url64 = "https://github.com/__APPREPO__/releases/download/v$version/__APPSLUG__-$version-windows-x86_64.zip"
$checksum64 = '0000000000000000000000000000000000000000000000000000000000000000'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Install-ChocolateyZipPackage `
    -PackageName '__APPSLUG__' `
    -Url64bit $url64 `
    -UnzipLocation $toolsDir `
    -Checksum64 $checksum64 `
    -ChecksumType64 'sha256'
