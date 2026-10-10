$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (!$chrome) { throw 'Chrome or Edge not found.' }
$profile = Join-Path $PSScriptRoot 'chrome-profile'
$html = @'
<!doctype html><meta charset="utf-8"><title>Wuying MCP - Browser Demo</title>
<style>body{background:#091521;color:#e4f6ff;font:24px Segoe UI;padding:70px}small{color:#6ae0ff}h1{font-size:54px}input,button{font:24px Segoe UI;padding:18px;border-radius:12px;border:0;margin:10px 0}button{background:#6ae0ff;cursor:pointer}#result{margin-top:35px;color:#77ffc7}</style>
<small>LIVE ON A WUYING CLOUD COMPUTER</small><h1>Browser Use via MCP</h1><p>A real browser. A real input. A verified result.</p><input id="name" placeholder="Enter a message"><br><button id="run" onclick="document.getElementById('result').textContent='Verified: '+document.getElementById('name').value">Verify interaction</button><div id="result">Waiting for browser input...</div>
'@
$page = Join-Path $PSScriptRoot 'browser-demo.html'
[IO.File]::WriteAllText($page, $html)
$p = Start-Process $chrome -ArgumentList @("--user-data-dir=`"$profile`"", '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--new-window', '--window-size=1280,850', "`"$page`"") -PassThru
$p.Id | Set-Content (Join-Path $PSScriptRoot 'browser.pid')
$portFile = Join-Path $profile 'DevToolsActivePort'
for ($i=0; $i -lt 40 -and !(Test-Path $portFile); $i++) { Start-Sleep -Milliseconds 250 }
if (!(Test-Path $portFile)) { throw 'Browser debug endpoint did not start.' }
$port = (Get-Content $portFile)[0]
$target = $null
for ($i=0; $i -lt 30; $i++) {
  $port = (Get-Content $portFile)[0]
  try { $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list" } catch { Start-Sleep -Milliseconds 300; continue }
  $target = $targets | Where-Object { $_.type -eq 'page' -and $_.url -like '*browser-demo.html*' } | Select-Object -First 1
  if ($target) { break }; Start-Sleep -Milliseconds 200
}
if (!$target) { throw 'Demo tab not found.' }
$ws = New-Object Net.WebSockets.ClientWebSocket
$cts = New-Object Threading.CancellationTokenSource
$cts.CancelAfter(20000)
$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl,$cts.Token).GetAwaiter().GetResult()
$script:seq = 0
function CDP($method, $params) {
  $script:seq++
  $id = $script:seq
  $json = @{id=$id;method=$method;params=$params} | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $segment = [ArraySegment[byte]]::new($bytes)
  $ws.SendAsync($segment,[Net.WebSockets.WebSocketMessageType]::Text,$true,$cts.Token).GetAwaiter().GetResult()
  do {
    $stream = New-Object IO.MemoryStream
    do {
      $buffer = New-Object byte[] 65536
      $received = $ws.ReceiveAsync([ArraySegment[byte]]::new($buffer),$cts.Token).GetAwaiter().GetResult()
      if ($received.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) { throw 'CDP socket closed.' }
      $stream.Write($buffer,0,$received.Count)
    } until ($received.EndOfMessage)
    $reply = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    $stream.Dispose()
  } until ($reply.id -eq $id)
  if ($reply.error) { throw 'CDP method failed.' }
  return $reply.result
}
function Evaluate($expression) {
  $r = CDP 'Runtime.evaluate' @{expression=$expression;returnByValue=$true}
  if ($r.exceptionDetails) { throw 'Browser evaluation failed.' }
  return $r.result.value
}
try {
  $null = CDP 'Page.bringToFront' @{}
  $before = Evaluate "({title:document.title,input:!!document.querySelector('#name'),button:!!document.querySelector('#run')})"
  if (!$before.input -or !$before.button) { throw 'Expected demo controls missing.' }
  $null = Evaluate "document.querySelector('#name').focus()"
  $null = CDP 'Input.insertText' @{text='Hello from Wuying MCP'}
  $point = Evaluate "(()=>{const r=document.querySelector('#run').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()"
  $null = CDP 'Input.dispatchMouseEvent' @{type='mousePressed';x=$point.x;y=$point.y;button='left';clickCount=1}
  $null = CDP 'Input.dispatchMouseEvent' @{type='mouseReleased';x=$point.x;y=$point.y;button='left';clickCount=1}
  $actual = Evaluate "document.querySelector('#result').textContent"
  if ($actual -ne 'Verified: Hello from Wuying MCP') { throw 'Browser result did not match input.' }
  $shot = CDP 'Page.captureScreenshot' @{format='png'}
  [IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'browser.png'),[Convert]::FromBase64String($shot.data))
  @{stage='browser';verified=$true;title=$before.title;actual=$actual;transport='Chrome DevTools Protocol via Wuying MCP shell'} | ConvertTo-Json -Compress
} finally { $ws.Dispose(); $cts.Dispose() }
