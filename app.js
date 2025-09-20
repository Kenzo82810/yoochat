const socket = io("https://yoochat-backend.onrender.com");

const el = id => document.getElementById(id);
let currentUser = null;
let selectedPrivate = null;

el('btnRegister').addEventListener('click', async ()=>{
  const username = el('username').value.trim(); const password = el('password').value;
  const r = await fetch('/api/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})});
  const j = await r.json(); el('authMsg').textContent = j.success ? 'Inscription OK' : (j.message||'Erreur');
});

el('btnLogin').addEventListener('click', async ()=>{
  const username = el('username').value.trim(); const password = el('password').value;
  const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})});
  const j = await r.json();
  if(j.success){ currentUser = username; socket.emit('auth', currentUser); enterChat(); } else el('authMsg').textContent = j.message || 'Erreur';
});

async function enterChat(){
  el('auth').style.display='none'; el('chat').style.display='flex'; el('me').textContent = currentUser;
  el('tabPublic').addEventListener('click', ()=>{ showPublic(); });
  el('tabPrivate').addEventListener('click', ()=>{ showPrivate(); });
  el('sendPublic').addEventListener('click', ()=> sendPublic());
  el('sendPrivate').addEventListener('click', ()=> sendPrivate());
  el('search').addEventListener('input', ()=> filterContacts());
  await loadUsers(); await refreshAll();
  setInterval(()=> refreshAll(), 2000);
}

async function loadUsers(){
  const r = await fetch('/api/users'); const users = await r.json();
  const ul = el('usersList'); ul.innerHTML='';
  users.filter(u=>u!==currentUser).forEach(u=>{
    const li = document.createElement('li'); li.dataset.user=u;
    li.onclick = ()=> { openPrivate(u); };
    const av = document.createElement('div'); av.className='avatar'; av.textContent = u.charAt(0).toUpperCase();
    const name = document.createElement('div'); name.textContent = u;
    const dot = document.createElement('div'); dot.className='online-dot';
    li.appendChild(av); li.appendChild(name); li.appendChild(dot); ul.appendChild(li);
  });
}

function filterContacts(){ const q = el('search').value.toLowerCase(); document.querySelectorAll('#usersList li').forEach(li=>{ const name = li.querySelector('div:nth-child(2)').innerText.toLowerCase(); li.style.display = name.includes(q) ? 'flex' : 'none'; }); }

function showPublic(){ el('publicWindow').style.display='block'; el('privateWindow').style.display='none'; el('tabPublic').classList.add('active'); el('tabPrivate').classList.remove('active'); el('chatHeader').textContent='Public chat'; selectedPrivate=null; refreshPublic(); }
function showPrivate(){ el('publicWindow').style.display='none'; el('privateWindow').style.display='block'; el('tabPrivate').classList.add('active'); el('tabPublic').classList.remove('active'); el('chatHeader').textContent='Privé'; }

async function refreshAll(){ refreshPublic(); if(selectedPrivate) refreshPrivate(selectedPrivate); updatePresenceDots(); }

async function refreshPublic(){ if(!currentUser) return; const r = await fetch('/api/messages/' + encodeURIComponent(currentUser)); const msgs = await r.json(); const pub = msgs.filter(m => m.to === 'ALL' || m.toType === 'public'); const cont = el('messagesPublic'); cont.innerHTML=''; pub.forEach(m=>{ const d = document.createElement('div'); d.className='message ' + (m.from===currentUser ? 'me' : 'other'); const meta = document.createElement('div'); meta.className='meta'; meta.textContent = (m.from) + ' — ' + m.time; const txt = document.createElement('div'); txt.innerHTML = escapeHtml(m.text); d.appendChild(meta); d.appendChild(txt); cont.appendChild(d); }); cont.scrollTop = cont.scrollHeight; }

async function refreshPrivate(user){ if(!currentUser) return; const r = await fetch('/api/messages/' + encodeURIComponent(currentUser)); const msgs = await r.json(); const cont = el('messagesPrivate'); cont.innerHTML=''; const conv = msgs.filter(m => (m.from===user && m.to===currentUser) || (m.from===currentUser && m.to===user)); conv.forEach(m=>{ const d = document.createElement('div'); d.className='message ' + (m.from===currentUser ? 'me' : 'other'); const meta = document.createElement('div'); meta.className='meta'; meta.textContent = (m.from===currentUser ? 'To ' + m.to : 'From ' + m.from) + ' — ' + m.time; const txt = document.createElement('div'); txt.innerHTML = escapeHtml(m.text); d.appendChild(meta); d.appendChild(txt); cont.appendChild(d); }); cont.scrollTop = cont.scrollHeight; }

function openPrivate(user){ selectedPrivate = user; showPrivate(); el('chatHeader').textContent = 'Conversation avec ' + user; refreshPrivate(user); }

async function sendPublic(){ const text = el('msgPublic').value.trim(); if(!text) return; socket.emit('send', { from: currentUser, to: 'ALL', toType:'public', text }); el('msgPublic').value=''; }
async function sendPrivate(){ const text = el('msgPrivate').value.trim(); if(!text || !selectedPrivate) return; socket.emit('send', { from: currentUser, to: selectedPrivate, toType:'private', text }); el('msgPrivate').value=''; }

socket.on('message', (m)=>{ if(m.from !== currentUser){ playBeep(); if(Notification.permission==='granted') new Notification('Nouveau message', { body: m.text }); } if(m.to === 'ALL' || m.toType==='public') refreshPublic(); if(m.toType==='private'){ if(m.from===selectedPrivate || m.to===selectedPrivate || m.from===currentUser || m.to===currentUser) refreshPrivate(selectedPrivate); } });

socket.on('presence', (arr)=>{ window._onlineUsers = arr; updatePresenceDots(); });

function updatePresenceDots(){ document.querySelectorAll('#usersList li').forEach(li=>{ const user = li.dataset.user; const dot = li.querySelector('.online-dot'); if(window._onlineUsers && window._onlineUsers.includes(user)){ dot.style.background='#2ecc71'; } else { dot.style.background='transparent'; dot.style.border='1px solid #333'; } }); }

function playBeep(){ try{ const ctx = new (window.AudioContext||window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sine'; o.frequency.value=800; g.gain.value=0.03; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 120); }catch(e){} }

function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

if(Notification && Notification.permission!=='granted') Notification.requestPermission();
