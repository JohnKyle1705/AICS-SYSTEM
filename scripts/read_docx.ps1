Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('AICS_System_Manuscript.docx')
$entry = $zip.GetEntry('word/document.xml')
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = [xml]$reader.ReadToEnd()
$stream.Close()
$zip.Dispose()
$nodes = $xml.SelectNodes('//*[local-name()="p"]')
foreach ($node in $nodes) {
    $pText = ($node.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join ''
    if ($pText.Trim().Length -gt 0) {
        Write-Output $pText
    }
}
