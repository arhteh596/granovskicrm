# Script to convert database dump to UTF-8 without BOM
$inputFile = "C:\Users\user\Desktop\Main\12121\database_dump.sql"
$outputFile = "C:\Users\user\Desktop\Main\12121\database_dump_utf8.sql"

Write-Host "Converting dump to UTF-8 without BOM..." -ForegroundColor Green

# Read file with UTF-8 encoding
$content = Get-Content -Path $inputFile -Raw -Encoding UTF8

# Write to UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outputFile, $content, $utf8NoBom)

Write-Host "Done! File saved: $outputFile" -ForegroundColor Green
Write-Host ""

# Check for Cyrillic characters
Write-Host "Checking for Cyrillic in file:" -ForegroundColor Yellow
$cyrillicMatches = Select-String -Path $outputFile -Pattern "[А-Яа-яЁё]" -Context 0,0 | Select-Object -First 5
foreach ($match in $cyrillicMatches) {
    $linePreview = $match.Line.Substring(0, [Math]::Min(100, $match.Line.Length))
    Write-Host "  Line $($match.LineNumber): $linePreview"
}

Write-Host ""
$fileSize = [math]::Round((Get-Item $outputFile).Length / 1MB, 2)
Write-Host "File size: $fileSize MB" -ForegroundColor Cyan
