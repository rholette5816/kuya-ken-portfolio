@echo off
cd /d "C:\Users\Donna Lim\Desktop\executive assistant\kuya-ken-portfolio"

node scripts\generate-os-snapshot.mjs
if %errorlevel% neq 0 (
  echo Snapshot generation failed.
  exit /b 1
)

copy /y "..\context\projects.json" "app\system\projects.json"
copy /y "..\context\journal.json" "app\system\journal.json"

git add app\system\activitySnapshot.json app\system\projects.json app\system\journal.json
git diff --cached --quiet && (
  echo No changes detected. Skipping commit.
  exit /b 0
)

git commit -m "Auto-refresh OS snapshot + projects + journal (%date%)"
git push

npx vercel --prod --yes
if %errorlevel% neq 0 (
  echo Vercel deploy failed.
  exit /b 1
)

echo Snapshot updated and deployed.
