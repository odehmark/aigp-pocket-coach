
const state = {
  questions: [], quiz: [], index: 0, selected: null, checked: false, answers: [],
  stats: JSON.parse(localStorage.getItem('aigpStats') || '{"answered":0,"correct":0,"byDomain":{}}'),
  bookmarks: JSON.parse(localStorage.getItem('aigpBookmarks') || '[]')
};

const views = [...document.querySelectorAll('.view')];
function showView(id){
  views.forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  if(id==='dashboardView') renderDashboard();
  if(id==='bookmarksView') renderBookmarks();
}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));

async function init(){
  state.questions = await fetch('data/questions.json').then(r=>r.json());
  if(localStorage.getItem('aigpTheme')==='dark') document.body.classList.add('dark');
  renderDashboard(); renderLibrary();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
}
document.getElementById('themeBtn').onclick=()=>{
  document.body.classList.toggle('dark');
  localStorage.setItem('aigpTheme',document.body.classList.contains('dark')?'dark':'light');
};

function save(){
  localStorage.setItem('aigpStats',JSON.stringify(state.stats));
  localStorage.setItem('aigpBookmarks',JSON.stringify(state.bookmarks));
}
function pct(a,b){ return b ? Math.round(a/b*100) : 0; }

function renderDashboard(){
  const accuracy=pct(state.stats.correct,state.stats.answered);
  const readiness=Math.min(100,Math.round(accuracy*.7 + Math.min(state.stats.answered,100)*.3));
  const ring=document.getElementById('readinessScore');
  ring.style.setProperty('--score',readiness+'%'); ring.dataset.score=readiness+'%';
  document.getElementById('completedStat').textContent=state.stats.answered;
  document.getElementById('accuracyStat').textContent=accuracy+'%';
  document.getElementById('bookmarkStat').textContent=state.bookmarks.length;
  const container=document.getElementById('domainBars'); container.innerHTML='';
  let weak={d:null,p:101};
  ['I','II','III','IV'].forEach(d=>{
    const x=state.stats.byDomain[d]||{answered:0,correct:0}; const p=pct(x.correct,x.answered);
    if(x.answered && p<weak.p) weak={d,p};
    container.innerHTML += `<div class="domain-row"><div class="label"><span>Domain ${d}</span><strong>${x.answered?p+'%':'Not started'}</strong></div><div class="bar"><div style="width:${p}%"></div></div></div>`;
  });
  document.getElementById('weakDomain').textContent=weak.d?`Weakest: Domain ${weak.d} (${weak.p}%)`:'No data yet';
}

document.querySelectorAll('.session-btn').forEach(b=>b.onclick=()=>startQuiz({count:+b.dataset.count,domain:'ALL',difficulty:'ALL'}));
document.getElementById('startCustomQuiz').onclick=()=>startQuiz({
  count:+document.getElementById('lengthFilter').value,
  domain:document.getElementById('domainFilter').value,
  difficulty:document.getElementById('difficultyFilter').value
});
function startQuiz({count,domain,difficulty}){
  let pool=state.questions.filter(q=>(domain==='ALL'||q.domain===domain)&&(difficulty==='ALL'||q.difficulty===difficulty));
  pool=[...pool].sort(()=>Math.random()-.5);
  state.quiz=pool.slice(0,Math.min(count,pool.length)); state.index=0; state.answers=[];
  if(!state.quiz.length) return alert('No questions match those filters.');
  showView('quizView'); renderQuestion();
}
function renderQuestion(){
  state.selected=null; state.checked=false;
  const q=state.quiz[state.index];
  document.getElementById('quizProgress').textContent=`${state.index+1} / ${state.quiz.length}`;
  document.getElementById('progressBar').style.width=`${(state.index/state.quiz.length)*100}%`;
  document.getElementById('domainBadge').textContent=`Domain ${q.domain}`;
  document.getElementById('difficultyBadge').textContent=q.difficulty;
  document.getElementById('questionText').textContent=q.question;
  document.getElementById('checkAnswer').disabled=true;
  document.getElementById('checkAnswer').classList.remove('hidden');
  document.getElementById('nextQuestion').classList.add('hidden');
  document.getElementById('feedback').classList.add('hidden');
  const options=document.getElementById('options'); options.innerHTML='';
  q.options.forEach((opt,i)=>{
    const btn=document.createElement('button'); btn.className='option';
    btn.innerHTML=`<span class="letter">${'ABCD'[i]}</span><span>${opt}</span>`;
    btn.onclick=()=>{ if(state.checked)return; state.selected=i; [...options.children].forEach(x=>x.classList.remove('selected')); btn.classList.add('selected'); document.getElementById('checkAnswer').disabled=false; };
    options.appendChild(btn);
  });
  document.getElementById('bookmarkBtn').textContent=state.bookmarks.includes(q.id)?'★':'☆';
}
document.getElementById('bookmarkBtn').onclick=()=>{
  const id=state.quiz[state.index].id;
  state.bookmarks=state.bookmarks.includes(id)?state.bookmarks.filter(x=>x!==id):[...state.bookmarks,id];
  save(); document.getElementById('bookmarkBtn').textContent=state.bookmarks.includes(id)?'★':'☆';
};
document.getElementById('checkAnswer').onclick=()=>{
  if(state.selected===null)return;
  state.checked=true; const q=state.quiz[state.index], correct=state.selected===q.correctIndex;
  [...document.getElementById('options').children].forEach((el,i)=>{ if(i===q.correctIndex)el.classList.add('correct'); else if(i===state.selected)el.classList.add('wrong'); });
  state.answers.push({domain:q.domain,correct});
  state.stats.answered++; if(correct)state.stats.correct++;
  state.stats.byDomain[q.domain] ||= {answered:0,correct:0};
  state.stats.byDomain[q.domain].answered++; if(correct)state.stats.byDomain[q.domain].correct++;
  save();
  const fb=document.getElementById('feedback');
  let extra=!correct ? `<p><strong>Why your choice was weaker:</strong> ${q.wrongExplanations[String(state.selected)]||'It did not address the core governance requirement.'}</p>` : '';
  fb.innerHTML=`<h4>${correct?'Correct':'Not quite'}</h4><p>${q.explanation}</p>${extra}<p><strong>Framework:</strong> ${q.framework}</p><p><strong>Exam trap:</strong> ${q.examTrap}</p>`;
  fb.classList.remove('hidden'); document.getElementById('checkAnswer').classList.add('hidden'); document.getElementById('nextQuestion').classList.remove('hidden');
};
document.getElementById('nextQuestion').onclick=()=>{
  state.index++; if(state.index>=state.quiz.length) showResults(); else renderQuestion();
};
document.getElementById('exitQuiz').onclick=()=>showView('dashboardView');
document.getElementById('backDashboard').onclick=()=>showView('dashboardView');

function showResults(){
  showView('resultsView');
  const correct=state.answers.filter(a=>a.correct).length, score=pct(correct,state.answers.length);
  document.getElementById('resultScore').textContent=score+'%';
  document.getElementById('resultText').textContent=`You answered ${correct} of ${state.answers.length} correctly. ${score>=80?'Strong performance.':'Review the explanations and repeat your weakest domain.'}`;
  const wrap=document.getElementById('resultBreakdown'); wrap.innerHTML='';
  ['I','II','III','IV'].forEach(d=>{
    const arr=state.answers.filter(a=>a.domain===d); if(!arr.length)return;
    wrap.innerHTML+=`<div class="breakdown-row"><span>Domain ${d}</span><strong>${pct(arr.filter(a=>a.correct).length,arr.length)}%</strong></div>`;
  });
}

function renderLibrary(){
  const summaries={
    I:['AI concepts and terminology','Roles and accountability','Lifecycle governance','Responsible AI principles'],
    II:['Privacy and data protection','Transparency and explainability','Fairness and non-discrimination','Laws, standards and regulatory mapping'],
    III:['Risk identification and assessment','Testing, validation and assurance','Human oversight','Vendor and incident risk'],
    IV:['Deployment readiness','Monitoring and drift','Change control','Retirement and records']
  };
  const names={I:'Foundations',II:'Laws & Responsible AI',III:'AI Risk Management',IV:'Deployment & Use'};
  const wrap=document.getElementById('libraryCards'); wrap.innerHTML='';
  Object.keys(summaries).forEach(d=>{
    wrap.innerHTML+=`<article class="card library-card"><span class="pill">Domain ${d}</span><h3>${names[d]}</h3><p>Focus on how principles become proportionate controls, evidence and accountable decisions.</p><ul>${summaries[d].map(x=>`<li>${x}</li>`).join('')}</ul><button onclick="startQuiz({count:10,domain:'${d}',difficulty:'ALL'})">Practice Domain ${d}</button></article>`;
  });
}
function renderBookmarks(){
  const list=document.getElementById('bookmarkList'); list.innerHTML='';
  const qs=state.questions.filter(q=>state.bookmarks.includes(q.id));
  if(!qs.length){list.innerHTML='<div class="card"><p>No saved questions yet. Tap ☆ during a quiz to bookmark a question.</p></div>';return;}
  qs.forEach(q=>{list.innerHTML+=`<article class="card bookmark-item"><span class="pill">Domain ${q.domain}</span><h3>${q.question}</h3><p>${q.topic} · ${q.difficulty}</p><button onclick="startBookmark(${q.id})">Practice this question</button></article>`;});
}
window.startBookmark=(id)=>{state.quiz=[state.questions.find(q=>q.id===id)];state.index=0;state.answers=[];showView('quizView');renderQuestion();};
init();
