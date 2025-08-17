
const el = (id)=>document.getElementById(id);
const $$ = (sel, ctx=document)=>Array.from(ctx.querySelectorAll(sel));

const S = {
  data: null,
  sections: [], // exercises
  cur: 0,
  score: 0
};

function normalize(s){
  return (s||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu,'')
    .replace(/[^a-z0-9]+/g,'');
}

async function loadAll(){
  const [qres, prefs] = await Promise.all([
    fetch('questions.json').then(r=>r.json()),
    fetch('references_pdfs.json').then(r=>r.json()).catch(()=>({pdfs:[]}))
  ]);
  S.data = qres;
  const subjects = S.data.subjects||[];
  const first = subjects[0]||{sections:[]};
  S.sections = first.sections||[];

  // fill select
  const sel = el('exerciseSelect'); sel.innerHTML='';
  S.sections.forEach((sec, i)=>{
    const o=document.createElement('option');
    o.value = i; o.textContent = sec.name||('Exercice '+(i+1));
    sel.appendChild(o);
  });

  // list PDFs
  const refsUl = el('refsList'); refsUl.innerHTML='';
  (prefs.pdfs||[]).forEach(p=>{
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = p.nom || p.file || 'PDF';
    a.href = p.path || p.file || '#';
    a.target = "_blank";
    li.appendChild(a);
    refsUl.appendChild(li);
  });

  render();
}

function getCurrent(){
  const sec = S.sections[S.cur] || {questions:[]};
  return {sec, idx:S.cur, total:S.sections.length};
}

function start(){
  const n = parseInt(el('exerciseSelect').value||'0',10);
  S.cur = isNaN(n)?0:n;
  S.score = 0;
  render();
}

function nav(dir){
  S.cur = Math.max(0, Math.min(S.sections.length-1, S.cur+dir));
  render();
}

function render(){
  const {sec, idx, total} = getCurrent();
  el('badgeProgress').textContent = `Exercice ${Math.min(idx+1,total)}/${total}`;
  el('badgeScore').textContent = `Score: ${S.score}`;

  const qhtml = (q, qi)=>{
    const header = `
      <div class="badge">Section: ${sec.name||''}</div>
      ${q.ref? `<div class="badge">Réf: ${q.ref.epreuve||''} ${q.ref.fichier?` · <a href="${q.ref.fichier}" target="_blank">PDF</a>`:''}</div>`:''}
      <div class="q-title">${escapeHTML(q.prompt||'')}</div>
      <hr class="line"/>
    `;

    if(q.type==='mcq'){
      const opts = (q.choices||[]).map((c,i)=>`
        <label class="choice"><input type="radio" name="q${qi}" value="${i}"><div>${escapeHTML(c)}</div></label>
      `).join('');
      return `<div class="q">${header}<div class="choices">${opts}</div><div class="feedback" id="fb${qi}"></div>
      <details><summary>Voir l'explication</summary><div>${escapeHTML(q.explain||'')}</div></details></div>`;
    }
    if(q.type==='short'){
      return `<div class="q">${header}<input type="text" id="short${qi}" placeholder="Écris ta réponse"/>
      <div class="feedback" id="fb${qi}"></div>
      <details><summary>Voir l'explication</summary><div>${escapeHTML(q.explain||'')}</div></details></div>`;
    }
    if(q.type==='image-id'){
      const img = q.image? `<div class="imgwrap"><img src="${q.image}" alt="image"/></div>`:'';
      if(q.mode==='mcq'){
        const opts = (q.choices||[]).map((c,i)=>`
          <label class="choice"><input type="radio" name="q${qi}" value="${i}"><div>${escapeHTML(c)}</div></label>
        `).join('');
        return `<div class="q">${header}${img}<div class="choices">${opts}</div><div class="feedback" id="fb${qi}"></div>
        <details><summary>Voir l'explication</summary><div>${escapeHTML(q.explain||'')}</div></details></div>`;
      } else {
        return `<div class="q">${header}${img}<input type="text" id="short${qi}" placeholder="Nom exact…"/>
        <div class="feedback" id="fb${qi}"></div>
        <details><summary>Voir l'explication</summary><div>${escapeHTML(q.explain||'')}</div></details></div>`;
      }
    }
    return `<div class="q">${header}<div class="feedback" id="fb${qi}">(Type non supporté)</div></div>`;
  };

  const inner = `
    <h2 style="margin:6px 0">${escapeHTML(sec.name||('Exercice '+(idx+1)))}</h2>
    ${(sec.questions||[]).map(qhtml).join('')}
  `;
  el('stage').innerHTML = inner;
}

function check(){
  const {sec} = getCurrent();
  let delta = 0;
  (sec.questions||[]).forEach((q, qi)=>{
    let ok=false;
    if(q.type==='mcq'){
      const sel = document.querySelector(`input[name="q${qi}"]:checked`);
      const v = sel? parseInt(sel.value,10) : -1;
      ok = (v===q.answer);
    } else if(q.type==='short' || (q.type==='image-id' && q.mode!=='mcq')){
      const v = (document.getElementById(`short${qi}`)?.value||'').trim().toLowerCase();
      const a = (q.answer_text||'').trim().toLowerCase();
      ok = normalize(v)===normalize(a);
    } else if(q.type==='image-id' && q.mode==='mcq'){
      const sel = document.querySelector(`input[name="q${qi}"]:checked`);
      const v = sel? parseInt(sel.value,10) : -1;
      ok = (v===q.answer);
    }
    delta += ok? 1 : -1;
    const fb = document.getElementById(`fb${qi}`);
    if(fb) fb.innerHTML = ok? `<div class="badge ok">✔ Correct (+1)</div>` : `<div class="badge bad">✖ Faux (−1)</div>`;
  });
  S.score += delta;
  el('badgeScore').textContent = `Score: ${S.score}`;
}

function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

// bind
window.addEventListener('DOMContentLoaded', ()=>{
  el('btnStart').addEventListener('click', start);
  el('btnPrev').addEventListener('click', ()=> nav(-1));
  el('btnNext').addEventListener('click', ()=> nav(1));
  el('btnCheck').addEventListener('click', check);
  loadAll();
});
