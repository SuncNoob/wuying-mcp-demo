$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class DemoWindows {
 [StructLayout(LayoutKind.Explicit, Size=40)] public struct Input {
  [FieldOffset(0)] public uint type;
  [FieldOffset(8)] public ushort key;
  [FieldOffset(10)] public ushort scan;
  [FieldOffset(12)] public uint flags;
 }
 [DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint n, Input[] inputs, int size);
 public static void TypeUnicode(IntPtr window, string text) {
  if(IntPtr.Size != 8) throw new Exception("64-bit Windows required.");
  foreach(char ch in text) {
   if(GetForegroundWindow()!=window) throw new Exception("Focus changed; input stopped.");
   Input[] inputs = {new Input{type=1,scan=ch,flags=4},new Input{type=1,scan=ch,flags=6}};
   if(SendInput(2,inputs,40)!=2) throw new Exception("Windows blocked input injection.");
  }
 }

 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);
}
'@
$fileName = 'Wuying-' + (Split-Path $PSScriptRoot -Leaf) + '.txt'
$file = Join-Path $PSScriptRoot $fileName
[IO.File]::WriteAllText($file,'')
$null = Start-Process notepad.exe -ArgumentList "`"$file`"" -PassThru
$root = [System.Windows.Automation.AutomationElement]::RootElement
$window = $null
for ($i=0; $i -lt 50; $i++) {
  $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
  foreach ($w in $windows) { if ($w.Current.ClassName -eq 'Notepad' -and $w.Current.Name.Contains([IO.Path]::GetFileNameWithoutExtension($fileName))) { $window=$w; break } }
  if ($window) { break }; Start-Sleep -Milliseconds 200
}
if (!$window) { throw 'The uniquely named demo document was not found. No input sent.' }
$h = [IntPtr]$window.Current.NativeWindowHandle
$null = [DemoWindows]::ShowWindow($h,3)
$null = [DemoWindows]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 300
$conditions = [System.Windows.Automation.OrCondition]::new(
 [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Document),
 [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit))
$edit = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$conditions)
if (!$edit) { throw 'Editor control not found. No input sent.' }
$pattern = $edit.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
if ($pattern.DocumentRange.GetText(-1).Trim().Length -ne 0) { throw 'Demo document is not empty. No input sent.' }
$edit.SetFocus()
if ([DemoWindows]::GetForegroundWindow() -ne $h -or !$edit.Current.HasKeyboardFocus) { throw 'Demo editor is not focused. No input sent.' }
$message = 'Hello from Wuying MCP - Computer Use verified'
[DemoWindows]::TypeUnicode($h,$message)
Start-Sleep -Milliseconds 300
for ($i=0; $i -lt 30; $i++) {
 $actual = $pattern.DocumentRange.GetText(-1).TrimEnd("`r","`n")
 if ($actual -eq $message) { break }; Start-Sleep -Milliseconds 100
}
if ($actual -ne $message) { throw ('Editor text did not match the sent keyboard input. Actual: ' + $actual) }
$bounds = $window.Current.BoundingRectangle
$bitmap = New-Object Drawing.Bitmap ([int]$bounds.Width),([int]$bounds.Height)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
try {
 $graphics.CopyFromScreen([int]$bounds.X,[int]$bounds.Y,0,0,$bitmap.Size)
 $bitmap.Save((Join-Path $PSScriptRoot 'desktop.png'),[Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $bitmap.Dispose() }
@{stage='desktop';verified=$true;actual=$actual;transport='Windows keyboard input and UI Automation via Wuying MCP shell';note='Unique demo document opened; typed text left unsaved for inspection.'} | ConvertTo-Json -Compress
