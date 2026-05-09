import requests
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}
url = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?tp=1&frmdt=01-Jan-2025&todt=31-Jan-2025"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Content Length: {len(response.text)}")
print(response.text[:500])
