import json, re

with open('.manus-logs/networkRequests.log', 'r') as f:
    content = f.read()

# Find the request body containing wrongAnswers
matches = re.findall(r'"wrongAnswers":\s*(\[.*?\])', content)
if matches:
    for m in matches[-1:]:
        try:
            arr = json.loads(m)
            for i, item in enumerate(arr):
                print(f'{i}: Q{item.get("questionId")} section={item.get("sectionType")} correctAnswer={repr(item.get("correctAnswer"))} question={item.get("questionText","")[:50]}')
        except json.JSONDecodeError:
            # Try to find the full array
            print("Could not parse, trying alternative...")
            pass
else:
    print("No wrongAnswers found in logs")
