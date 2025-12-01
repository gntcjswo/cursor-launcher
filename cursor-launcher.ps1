# UTF-8 출력 헬퍼 함수
$utf8Output = [Console]::OpenStandardOutput()
function Write-UTF8 {
  param([string]$Text)
  $utf8 = [System.Text.Encoding]::UTF8
  $bytes = $utf8.GetBytes($Text + "`r`n")
  $utf8Output.Write($bytes, 0, $bytes.Length)
  $utf8Output.Flush()
}

# 콘솔 코드 페이지를 UTF-8로 설정
Add-Type -TypeDefinition @"
  using System;
  using System.Runtime.InteropServices;
  public class ConsoleHelper {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleOutputCP(uint wCodePageID);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleCP(uint wCodePageID);
  }
"@
[ConsoleHelper]::SetConsoleOutputCP(65001) | Out-Null
[ConsoleHelper]::SetConsoleCP(65001) | Out-Null
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

# ==================================================
# cursor-launcher.ps1
# 프로젝트 열기 + 최근/즐겨찾기 관리
# ==================================================

# 파일 경로
$projectsDisplayFile = ".\projects_display.txt"
$projectsPathFile = ".\projects_path.txt"
$favoriteFile = ".\favorite.txt"
$recentFile = ".\recent.txt"

# 최근/즐겨찾기 초기화
if (!(Test-Path $favoriteFile)) { "" | Out-File $favoriteFile -Encoding UTF8 }
if (!(Test-Path $recentFile)) { "" | Out-File $recentFile -Encoding UTF8 }

# 프로젝트 정보 읽기
$projectNames = Get-Content $projectsDisplayFile -Encoding UTF8
$projectPaths = Get-Content $projectsPathFile -Encoding UTF8

# 화면 표시 함수
function Show-ProjectList {
  param(
    [array]$RecentProjects,
    [array]$Favorites
  )
  cls
  Write-UTF8 "============================"
  Write-UTF8 "       Project List"
  Write-UTF8 "============================"

  # 최근 프로젝트 표시
  if ($RecentProjects.Count -gt 0) {
    Write-UTF8 ""
    Write-UTF8 "--- Recent ---"
    foreach ($name in $RecentProjects) {
      $index = $projectNames.IndexOf($name) + 1
      $star = if ($Favorites -contains $name) { "*" } else { " " }
      Write-UTF8 "$index. [$star] $name"
    }
  }

  # 즐겨찾기 표시 (모든 즐겨찾기 표시)
  if ($Favorites.Count -gt 0) {
    Write-UTF8 ""
    Write-UTF8 "--- Favorites ---"
    foreach ($name in $Favorites) {
      $index = $projectNames.IndexOf($name) + 1
      Write-UTF8 "$index. [*] $name"
    }
  }

  # 전체 프로젝트 리스트 표시 (원래 순서 유지)
  Write-UTF8 ""
  Write-UTF8 "--- All Projects ---"
  for ($i=0; $i -lt $projectNames.Count; $i++) {
    $index = $i + 1
    $name = $projectNames[$i]
    $star = if ($Favorites -contains $name) { "*" } else { " " }
    Write-UTF8 "$index. [$star] $name"
  }
  Write-UTF8 "============================"
  Write-UTF8 "Enter number with * to toggle favorites (e.g., 3*)"
}

# 최근/즐겨찾기 읽기 함수
function Read-ProjectData {
  $recent = @(Get-Content $recentFile -Encoding UTF8 | Where-Object {$_ -ne ""} | Where-Object {$projectNames -contains $_} | Select-Object -First 8)
  $fav = @(Get-Content $favoriteFile -Encoding UTF8 | Where-Object {$_ -ne ""} | Where-Object {$projectNames -contains $_})
  return @{Recent=$recent; Favorites=$fav}
}

# 메인 루프
$data = Read-ProjectData
$recentProjects = $data.Recent
$favorites = $data.Favorites

while ($true) {
  # 화면 표시
  Show-ProjectList -RecentProjects $recentProjects -Favorites $favorites
  Write-Host "Enter project number: " -NoNewline
  $choice = Read-Host

  # 즐겨찾기 처리
  if ($choice -match "(\d+)\*?") {
    $num = [int]$matches[1] - 1
    if ($num -ge 0 -and $num -lt $projectNames.Count) {
      $projName = $projectNames[$num]
      $projPath = $projectPaths[$num]
      $isFavoriteAction = $choice.EndsWith("*")
      
      # 즐겨찾기 추가/제거
      if ($isFavoriteAction) {
        if ($favorites -contains $projName) {
          # 즐겨찾기에서 제거
          $favorites = @($favorites | Where-Object {$_ -ne $projName})
          Set-Content $favoriteFile $favorites -Encoding UTF8
        } else {
          # 즐겨찾기에 추가
          $favorites = @($favorites + $projName)
          Set-Content $favoriteFile $favorites -Encoding UTF8
        }
        # 데이터 다시 읽기
        $data = Read-ProjectData
        $recentProjects = $data.Recent
        $favorites = $data.Favorites
      } else {
        # 최근 목록 갱신 (최대 8개 유지)
        $recentProjects = @($recentProjects | Where-Object {$_ -ne $projName})
        $recentProjects = @(,$projName + $recentProjects)
        $recentProjects = $recentProjects | Select-Object -First 8
        Set-Content $recentFile $recentProjects -Encoding UTF8
        # Cursor로 프로젝트 열기 (창 숨김)
        Start-Process "cursor" -ArgumentList $projPath -WindowStyle Hidden
        # CMD 창 닫기 (부모 프로세스 포함)
        try {
          $parentId = (Get-CimInstance Win32_Process -Filter "ProcessId = $PID").ParentProcessId
          $parentProcess = Get-Process -Id $parentId -ErrorAction SilentlyContinue
          if ($parentProcess -and ($parentProcess.ProcessName -eq "cmd" -or $parentProcess.ProcessName -eq "cmd.exe")) {
            Stop-Process -Id $parentId -Force
          }
        } catch {
          # 부모 프로세스 찾기 실패 시 현재 프로세스만 종료
        }
        [Environment]::Exit(0)
      }
    } else {
      Write-UTF8 "Invalid input."
      Start-Sleep -Milliseconds 1000
    }
  } else {
    Write-UTF8 "Invalid input."
    Start-Sleep -Milliseconds 1000
  }
}
