Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('AICS_System_Manuscript.docx')
$entry = $zip.GetEntry('word/document.xml')
$reader = New-Object System.IO.StreamReader($entry.Open())
$xml = [xml]$reader.ReadToEnd()
$reader.Close()
$zip.Dispose()

$paragraphs = @()
$nodes = $xml.SelectNodes('//*[local-name()="p"]')
foreach ($node in $nodes) {
    $text = ($node.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join ''
    if ($text.Trim().Length -gt 0) {
        $paragraphs += $text.Trim()
    }
}

for ($i = 520; $i -lt [Math]::Min(550, $paragraphs.Count); $i++) {
    Write-Output "[$i] $($paragraphs[$i])"
}
