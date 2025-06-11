const express = require('express');
const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(express.static('public'));


const upload = multer({ storage: multer.memoryStorage() });

function calculateScore(skills, tools) {
  const base = 2;
  return Math.min(5, base + (skills.length + tools.length) * 0.3).toFixed(1);
}

function buildHTML(template, data) {
  function listHTML(val) {
    if (Array.isArray(val)) return val.map(v => `<li>${v.trim()}</li>`).join('');
    if (typeof val === 'string') return val.split('\n').filter(Boolean).map(v => `<li>${v.trim()}</li>`).join('');
    return '';
  }


  const profilePicHTML = data.profile_pic
    ? `<img src="data:${data.profile_pic.mimetype};base64,${data.profile_pic.base64}" alt="Profile Picture" class="profile-pic">`
    : '';

  return template
    .replace('{{profile_pic}}', profilePicHTML)
    .replace('{{name}}', data.name)
    .replace('{{age}}', data.age)
    .replace('{{location}}', data.location)
    .replace('{{skills}}', listHTML(data.skills))
    .replace('{{tools}}', listHTML(data.tools))
    .replace('{{work}}', data.work)
    .replace('{{education}}', data.education)
    .replace('{{score}}', data.score)
    .replace('{{hire_if_you_want}}', data.hire_if_you_want)
    .replace('{{strengths}}', listHTML(data.strengths))
    .replace('{{gaps}}', listHTML(data.gaps));
}


app.post('/generate', upload.single('profile_pic'), async (req, res) => {
  const {
    name,
    age,
    location,
    skills,
    tools,
    work,
    education,
    hire_if_you_want,
    strengths,
    gaps
  } = req.body;

  const skillList = skills ? skills.split(',') : [];
  const toolList = tools ? tools.split(',') : [];
  const strengthsList = strengths ? strengths.split('\n').filter(Boolean) : [];
  const gapsList = gaps ? gaps.split('\n').filter(Boolean) : [];
  const score = calculateScore(skillList, toolList);

 
  let profile_pic = null;
  if (req.file) {
    profile_pic = {
      mimetype: req.file.mimetype,
      base64: req.file.buffer.toString('base64')
    };
  }

  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');
  const finalHTML = buildHTML(template, {
    name: name || '',
    age: age || '',
    location: location || '',
    skills: skillList,
    tools: toolList,
    work: work || '',
    education: education || '',
    score,
    hire_if_you_want: hire_if_you_want || '',
    strengths: strengthsList,
    gaps: gapsList,
    profile_pic
  });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(finalHTML, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename=jobseeker-profile.pdf',
  });

  res.send(pdfBuffer);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});