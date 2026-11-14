# Builds the lite edition: one EXE with the page, bridge, icon and the WebView2 SDK files embedded.
# Needs only what Windows ships (the .NET Framework 4.8 C# compiler) plus Node for tools\prepare.cjs.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$version = '1.12.0'
$sdk = (Resolve-Path (Join-Path $root '..\third_party\microsoft.web.webview2.1.0.4314.35\extracted')).Path
$obj = Join-Path $root 'obj'
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $obj, $dist | Out-Null

node (Join-Path $root 'tools\prepare.cjs')
if ($LASTEXITCODE) { throw 'prepare.cjs failed' }

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$exe = Join-Path $obj 'WorkCheerLite.exe'
$sources = Get-ChildItem (Join-Path $root 'src') -Filter *.cs | ForEach-Object FullName
$arguments = @(
  '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/langversion:5', '/utf8output', "/out:$exe", "/win32icon:$obj\icon.ico",
  '/r:System.dll', '/r:System.Core.dll', '/r:System.Drawing.dll', '/r:System.Windows.Forms.dll', '/r:System.Web.Extensions.dll',
  "/r:$sdk\Microsoft.Web.WebView2.Core.dll", "/r:$sdk\Microsoft.Web.WebView2.WinForms.dll",
  "/resource:$sdk\Microsoft.Web.WebView2.Core.dll,Microsoft.Web.WebView2.Core.dll",
  "/resource:$sdk\Microsoft.Web.WebView2.WinForms.dll,Microsoft.Web.WebView2.WinForms.dll",
  "/resource:$sdk\WebView2Loader.dll,WebView2Loader.dll",
  "/resource:$obj\index.html,index.html", "/resource:$root\src\bridge.js,bridge.js", "/resource:$obj\icon.ico,icon.ico",
  # Numeral fonts for the 像素 / 液晶 floating widgets (made by ../work-cheer/scripts/make-display-fonts.py).
  "/resource:$root\fonts\wc-pixel.ttf,wc-pixel.ttf", "/resource:$root\fonts\wc-lcd.ttf,wc-lcd.ttf"
) + $sources
& $csc @arguments
if ($LASTEXITCODE) { throw 'csc failed' }

$target = Join-Path $dist "上班鼓励器-轻量版-$version.exe"
Copy-Item -LiteralPath $exe -Destination $target -Force
Get-Item -LiteralPath $target | Select-Object Name, Length
