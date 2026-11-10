(() => {
  'use strict';
  const root = document.getElementById('app');
  const toastHost = document.getElementById('toast-host');
  const S = {
    token: localStorage.getItem('ab_token') || '', user: null, meta: null,
    neighborhood: localStorage.getItem('ab_neighborhood') || '',
    notices: [], unread: 0, menu: '', renderId: 0,
    alertTab: 'active', search: '', reportStep: 1, report: {}, transitionTo: ''
  };
  const paths = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    back:'<path d="M19 12H5m6 6-6-6 6-6"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    check:'<path d="m20 6-11 11-5-5"/>',
    close:'<path d="M18 6 6 18M6 6l12 12"/>',
    activity:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v2"/><circle cx="8" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    logout:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
    search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
    clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alert:'<path d="M10.3 3.4 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'
  };
  const icon = (name, size=18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => Number(v) || 0;
  const date = v => {
    if (!v) return 'Data não informada';
    const text = String(v).replace(' ','T');
    const parsed = new Date(text + (text.endsWith('Z') || /[+-]\d\d:\d\d$/.test(text) ? '' : 'Z'));
    return Number.isNaN(parsed.getTime()) ? esc(text.slice(0,16)) : new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(parsed);
  };
  const dateTime = v => {
    if (!v) return 'Data não informada';
    const text = String(v).replace(' ','T');
    const parsed = new Date(text + (text.endsWith('Z') || /[+-]\d\d:\d\d$/.test(text) ? '' : 'Z'));
    return Number.isNaN(parsed.getTime()) ? esc(text.slice(0,16)) : new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(parsed);
  };
  const statusLabel = s => ({'Registrado':'Recebido','Em validação':'Em análise','Confirmado':'Confirmado','Alerta emitido':'Alerta enviado','Em monitoramento':'Em acompanhamento','Encerrado':'Resolvido','Descartado':'Não confirmado'})[s] || s || 'Recebido';
  const statusTone = s => ({'Registrado':'pending','Em validação':'pending','Confirmado':'active','Alerta emitido':'alert','Em monitoramento':'active','Encerrado':'closed','Descartado':'discarded'})[s] || '';
  const pill = s => `<span class="pill ${statusTone(s)}" title="Estado técnico: ${esc(s)}">${esc(statusLabel(s))}</span>`;
  const roleLabel = role => ({morador:'Morador',agente:'Agente',gestor:'Gestor'})[role] || 'Usuário';
  const initials = name => String(name || 'AB').split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();
  const firstName = name => String(name || 'vizinho').split(/\s+/)[0];
  const isStaff = () => ['agente','gestor'].includes(S.user?.role);
  const activeStatuses = ['Alerta emitido','Em monitoramento'];
  const legacy = { dashboard:'inicio', validacao:'fila' };
  const route = () => legacy[(location.hash || '#inicio').slice(1).split('/')[0]] || (location.hash || '#inicio').slice(1).split('/')[0] || 'inicio';
  const routeId = () => (location.hash || '').slice(1).split('/')[1] || '';
  const navigate = dest => { const target=`#${dest}`; if(location.hash===target) render(); else location.hash=target; };
  const loading = () => `<div class="loading"><div><div class="spinner"></div>Carregando…</div></div>`;
  function toast(message,type='') { const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; toastHost.append(el); setTimeout(()=>el.remove(),4300); }
  function empty(title,description,action='') { return `<div class="card"><div class="empty"><div class="empty-icon">${icon('check',22)}</div><h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div></div>`; }
  function errorCard(message) { return `<div class="card error-card"><div class="empty"><div class="empty-icon">${icon('alert',22)}</div><h3>Não foi possível carregar</h3><p>${esc(message)}</p><button class="btn btn-secondary" data-action="retry">Tentar novamente</button></div></div>`; }
  function pageHead(kicker,title,description,action='') { return `<div class="page-head page-head-row"><div><div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action?`<div class="actions">${action}</div>`:''}</div>`; }
  async function api(path,options={}) {
    const headers={Accept:'application/json',...options.headers};
    if(options.body!==undefined) headers['Content-Type']='application/json';
    if(S.token) headers.Authorization=`Bearer ${S.token}`;
    let response;
    try { response=await fetch(path,{...options,headers}); }
    catch { throw new Error('Sem conexão com a API. Verifique se o servidor está em execução.'); }
    let data={}; try { data=await response.json(); } catch { /* Empty response. */ }
    if(!response.ok) {
      if(response.status===401 && path!=='/api/auth/login') { clearSession(); throw new Error('Sua sessão expirou. Entre novamente.'); }
      throw new Error(data.error || data.message || `Falha na solicitação (${response.status}).`);
    }
    return data;
  }
  function clearSession() { S.token='';S.user=null;localStorage.removeItem('ab_token');loginPage(); }
  async function logout() { try { await api('/api/auth/logout',{method:'POST',body:'{}'}); } catch { /* Local logout still completes. */ } clearSession(); toast('Você saiu da conta.'); }
  async function syncNotices() { if(!S.user)return;try{const data=await api('/api/notifications');S.notices=data.items||[];S.unread=num(data.unread);const bell=root.querySelector('[data-action="notices"]');if(bell)bell.innerHTML=`${icon('bell',19)}${S.unread?'<i class="dot"></i>':''}`;}catch{/* Main screen remains available. */} }
  async function getAllOccurrences() { const items=[];let page=1,total=0;do{const data=await api(`/api/occurrences?limit=100&page=${page}`);items.push(...(data.items||[]));total=num(data.total);page++;if(!(data.items||[]).length)break;}while(items.length<total&&page<=100);return items; }
  function noticePopover() { return `<div class="popover" id="active-popover"><div class="popover-title">Notificações${S.unread?` · ${S.unread} nova${S.unread===1?'':'s'}`:''}</div>${S.notices.length?S.notices.slice(0,10).map(item=>`<div class="notice-item ${item.is_read?'':'unread'}" data-notice="${esc(item.id)}" role="button" tabindex="0"><span class="notice-icon">${icon('bell',17)}</span><span><strong>${esc(item.title||'Alerta do bairro')}</strong><p>${esc(item.body||'')}</p><small>${dateTime(item.created_at)}</small></span></div>`).join(''):`<div class="empty"><p>Nenhuma notificação por enquanto.</p></div>`}<a class="menu-item" href="#alertas">${icon('bell',17)} Ver todos os alertas</a></div>`; }
  function morePopover() { return `<div class="popover" id="active-popover"><div class="menu-caption">Explorar</div><a class="menu-item" href="#ocorrencias">${icon('list',18)} Todas as ocorrências</a><a class="menu-item" href="#mapa">${icon('map',18)} Mapa por bairro</a><a class="menu-item" href="#fontes">${icon('info',18)} Origem e confiança</a>${isStaff()?`<div class="menu-divider"></div><div class="menu-caption">Área do agente</div><a class="menu-item" href="#fila">${icon('shield',18)} Fila de análise</a><a class="menu-item" href="#monitoramento">${icon('activity',18)} Monitoramento</a>${S.user.role==='gestor'?`<a class="menu-item" href="#administracao">${icon('users',18)} Administração</a>`:''}`:''}</div>`; }
  function profilePopover() { return `<div class="popover" id="active-popover"><div class="popover-title">${esc(S.user?.name)}<small style="display:block;color:var(--muted);font-weight:500">${esc(roleLabel(S.user?.role))} · conta local</small></div><button class="menu-item" data-action="logout">${icon('logout',18)} Sair da conta</button></div>`; }
  function setPopover(type) { root.querySelector('#active-popover')?.remove();S.menu=S.menu===type?'':type;if(S.menu){const html=type==='more'?morePopover():type==='notices'?noticePopover():profilePopover();root.querySelector('.header')?.insertAdjacentHTML('beforeend',html);root.querySelector('#active-popover a, #active-popover button, #active-popover [tabindex]')?.focus();}root.querySelectorAll('[data-action="more"],[data-action="notices"],[data-action="profile"]').forEach(el=>el.setAttribute('aria-expanded',String(el.dataset.action===S.menu))); }
  function shell() {
    const active=route()==='detalhe'?'acompanhar':route();
    const primary=[['inicio','home','Início'],['alertas','bell','Alertas'],['registrar','plus','Registrar'],['acompanhar','list','Acompanhar']];
    return `<div class="app"><a class="skip-link" href="#main-content">Pular para o conteúdo</a><header class="header"><div class="header-inner"><a class="brand" href="#inicio" aria-label="AlertaBairro, Início"><span class="brand-mark">${icon('activity',22)}</span>AlertaBairro</a><nav class="desktop-nav" aria-label="Navegação principal">${primary.map(([key,ico,label])=>`<a href="#${key}" class="${active===key?'active':''}" ${active===key?'aria-current="page"':''}>${esc(label)}</a>`).join('')}</nav><span class="header-spacer"></span><div class="header-actions"><button class="icon-btn" data-action="more" aria-label="Mais opções" aria-expanded="false" aria-haspopup="true">${icon('menu',19)}</button><button class="icon-btn" data-action="notices" aria-label="Notificações" aria-expanded="false" aria-haspopup="true">${icon('bell',19)}${S.unread?'<i class="dot"></i>':''}</button><button class="profile-btn" data-action="profile" aria-label="Perfil de ${esc(S.user?.name)}" aria-expanded="false" aria-haspopup="true"><span class="avatar">${esc(initials(S.user?.name))}</span><span class="name">${esc(S.user?.name)}<small>${esc(roleLabel(S.user?.role))}</small></span></button></div></div></header><main class="main" id="main-content" tabindex="-1">${loading()}</main><nav class="bottom-nav" aria-label="Navegação principal">${primary.map(([key,ico,label])=>`<a href="#${key}" class="${active===key?'active':''}" ${active===key?'aria-current="page"':''}>${icon(ico,20)}<span>${esc(label)}</span></a>`).join('')}</nav></div>`;
  }
  function loginPage() {
    document.title='Entrar · AlertaBairro';
    root.innerHTML=`<div class="login"><div class="login-wrap"><div class="login-brand"><span class="brand-mark">${icon('activity',22)}</span>AlertaBairro</div><section class="login-card"><div class="kicker">Comunidade mais informada</div><h1>Bem-vindo ao seu bairro.</h1><p>Veja alertas, registre o que acontece e acompanhe as respostas em um só lugar.</p><div class="btn-row" style="margin-top:20px"><a href="#entrar" class="btn btn-quiet" aria-current="page">Entrar</a><a href="#cadastro" class="btn btn-primary">Criar conta</a></div><form id="login-form" class="login-form"><div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="username" required placeholder="voce@exemplo.com"></div><div class="field"><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="Sua senha"></div><div id="login-error" role="alert"></div><button class="btn btn-primary btn-large btn-block" type="submit">Entrar ${icon('arrow',18)}</button></form><details class="details"><summary>Testar com uma conta de demonstração</summary><div class="demo-grid"><button data-demo="morador">Morador</button><button data-demo="agente">Agente</button><button data-demo="gestor">Gestor</button></div></details></section><p class="login-foot">Protótipo acadêmico · Global Solution FIAP 2026.2</p></div></div>`;
  }
  function registrationPage() {
    root.innerHTML=`<div class="login"><div class="login-wrap"><section class="login-card"><div class="kicker">AlertaBairro</div><h1>Crie sua conta</h1><p>Cadastre-se como morador para registrar e acompanhar ocorrências.</p><form id="registration-form" class="login-form"><div class="field"><label for="reg-name">Seu nome</label><input id="reg-name" name="name" autocomplete="name" required minlength="2" maxlength="100"></div><div class="field"><label for="reg-email">E-mail</label><input id="reg-email" name="email" type="email" autocomplete="email" required maxlength="254"></div><div class="field"><label for="reg-password">Senha</label><input id="reg-password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"><small>Use pelo menos 8 caracteres.</small></div><div class="field"><label for="reg-confirm">Repita a senha</label><input id="reg-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></div><div id="registration-error" role="alert"></div><button class="btn btn-primary btn-large" type="submit">Criar conta</button><button class="btn btn-secondary" type="button" data-action="back-login">Já tenho uma conta</button></form></section></div></div>`;
  }
  async function registerAccount(form) {
    const values=Object.fromEntries(new FormData(form));
    const error=root.querySelector('#registration-error');
    if(values.password!==values.confirm){error.textContent='As senhas precisam ser iguais.';return;}
    const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Criando conta…';
    try {
      await api('/api/auth/register',{method:'POST',body:JSON.stringify({name:values.name,email:values.email,password:values.password})});
      history.replaceState(null,'','#entrar');loginPage();root.querySelector('#login-email').value=values.email;
      toast('Conta criada! Entre com seu e-mail e senha.','success');
    } catch(err){error.textContent=err.message;button.disabled=false;button.textContent='Criar conta';}
  }
  function alertCard(a) { return `<article class="alert-card"><div class="alert-top"><span class="alert-icon">${icon('bell',17)}</span>${pill(a.status)}</div><div><h3>${esc(a.title||'Alerta no bairro')}</h3><p>${esc(a.message)}</p></div><div class="alert-foot"><span>${icon('pin',13)} ${esc(a.neighborhood)} · ${date(a.created_at)}</span><a class="text-link" href="#detalhe/${esc(a.occurrence_id)}">Ver detalhes ${icon('arrow',13)}</a></div></article>`; }
  function occurrenceItem(o) { return `<button class="list-item" data-detail="${esc(o.id)}"><span class="list-icon">${icon('pin',18)}</span><span class="item-main"><span class="item-title">${esc(o.title)}</span><span class="item-sub">${esc(o.neighborhood)} · ${date(o.created_at)}</span></span>${pill(o.status)}<span class="chev">${icon('chevron',15)}</span></button>`; }
  function neighborhoodOptions(names) { return `<option value="">Todos os bairros</option>${names.map(name=>`<option value="${esc(name)}" ${S.neighborhood===name?'selected':''}>${esc(name)}</option>`).join('')}`; }
  async function homePage() {
    const [alerts,occurrences]=await Promise.all([api('/api/alerts'),getAllOccurrences()]);
    const all=alerts.items||[];
    const neighborhoods=[...new Set([...occurrences.map(o=>o.neighborhood),...all.map(a=>a.neighborhood)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if(S.neighborhood&&!neighborhoods.includes(S.neighborhood)) neighborhoods.unshift(S.neighborhood);
    const active=all.filter(a=>activeStatuses.includes(a.status)&&(!S.neighborhood||a.neighborhood===S.neighborhood));
    const mine=occurrences.filter(o=>o.reporter_id===S.user.id).slice(0,3);
    return `<section class="welcome"><div class="kicker">Olá, ${esc(firstName(S.user.name))}</div><h1>Seu bairro, por perto.</h1><p>Veja os avisos da região e conte o que você viu.</p><div class="field" style="max-width:350px"><label for="neighborhood-filter">Qual bairro você quer ver?</label><select id="neighborhood-filter">${neighborhoodOptions(neighborhoods)}</select></div></section><div class="home-grid" style="margin-top:22px"><div class="home-main"><section><div class="section-head"><div><h2>Alertas ativos${S.neighborhood?` em ${esc(S.neighborhood)}`:''}</h2><p>${active.length?`${active.length} comunicado${active.length===1?'':'s'} em acompanhamento`:'Nenhum comunicado ativo nesta seleção'}</p></div><a class="text-link" href="#alertas">Ver todos ${icon('arrow',13)}</a></div><div class="stack">${active.length?active.slice(0,3).map(alertCard).join(''):empty(S.neighborhood?'Nenhum alerta neste bairro':'Nenhum alerta ativo','Não há alertas ativos para esta seleção. Você pode consultar o histórico ou registrar uma situação.',`<a href="#alertas" class="btn btn-secondary">Consultar alertas</a>`)}</div></section><div class="report-cta"><span class="cta-icon">${icon('plus',23)}</span><span><strong>Viu algo importante?</strong><p>Seu relato ajuda a equipe a entender e verificar a situação.</p></span><a href="#registrar" class="btn btn-primary">Registrar ocorrência ${icon('arrow',15)}</a></div></div><aside class="home-side"><section class="card"><div class="section-head"><div><h2>Seus relatos</h2><p>Acompanhe o que você registrou</p></div></div>${mine.length?`<div class="simple-list">${mine.map(occurrenceItem).join('')}</div>`:`<p style="margin:0 0 13px">Você ainda não registrou nenhuma ocorrência.</p>`}<a href="#acompanhar" class="text-link">Acompanhar relatos ${icon('arrow',13)}</a></section><section class="card flat"><h3>Como funciona</h3><div class="mini-steps"><div class="mini-step"><span class="step-num">1</span><span><strong>Você conta o que viu</strong><p>Um relato simples inicia o acompanhamento.</p></span></div><div class="mini-step"><span class="step-num">2</span><span><strong>Um agente verifica</strong><p>A equipe analisa a situação antes de alertar.</p></span></div><div class="mini-step"><span class="step-num">3</span><span><strong>O bairro acompanha</strong><p>Alertas e mudanças de estado ficam visíveis.</p></span></div></div></section>${isStaff()?`<a href="#fila" class="btn btn-secondary btn-block">${icon('shield',17)} Abrir área do agente</a>`:''}</aside></div>`;
  }
  async function alertsPage() {
    const data=await api('/api/alerts');
    const all=data.items||[];
    const neighborhoods=[...new Set(all.map(a=>a.neighborhood).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if(S.neighborhood&&!neighborhoods.includes(S.neighborhood))neighborhoods.unshift(S.neighborhood);
    const filtered=all.filter(a=>(!S.neighborhood||a.neighborhood===S.neighborhood)&&(S.alertTab==='active'?activeStatuses.includes(a.status):!activeStatuses.includes(a.status)));
    return `${pageHead('Comunicados da comunidade','Alertas','Acompanhe avisos verificados e consulte o histórico de situações anteriores.')}<div class="filter-row" style="margin-bottom:16px"><div class="field"><label for="neighborhood-filter">Bairro</label><select id="neighborhood-filter">${neighborhoodOptions(neighborhoods)}</select></div></div><div class="tabs" role="group" aria-label="Período dos alertas"><button class="tab ${S.alertTab==='active'?'active':''}" data-alert-tab="active" aria-pressed="${S.alertTab==='active'}">Ativos</button><button class="tab ${S.alertTab==='history'?'active':''}" data-alert-tab="history" aria-pressed="${S.alertTab==='history'}">Histórico</button></div><div class="stack">${filtered.length?filtered.map(alertCard).join(''):empty(S.alertTab==='active'?'Nenhum alerta ativo':'Histórico vazio',S.neighborhood?`Não há ${S.alertTab==='active'?'alertas ativos':'alertas encerrados'} em ${S.neighborhood}. Escolha outro bairro ou veja todos.`:'Os comunicados aparecerão aqui quando forem emitidos.',`<a href="#registrar" class="btn btn-secondary">Registrar uma situação</a>`)}</div><div class="note" style="margin-top:17px">Os alertas são emitidos por agentes após a confirmação de uma ocorrência. Este protótipo envia notificações apenas dentro da aplicação.</div>`;
  }
  function reportPage() {
    const step=S.reportStep;
    const types=S.meta?.types||['Alagamento','Deslizamento','Incêndio','Queda de árvore','Falta de energia','Outro'];
    const stepTitles=['','O que aconteceu?','Onde aconteceu?','Qual é a urgência?'];
    const stepText=['','Conte o que observou em poucas palavras.','Informe o bairro; o endereço exato é opcional.','Diga como percebe a situação. Um agente fará a validação.'];
    const typeField=`<div class="field"><label for="report-type">Tipo de ocorrência</label><select id="report-type" name="type" required><option value="">Escolha uma opção</option>${types.map(t=>`<option value="${esc(t)}" ${S.report.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
    const fields=step===1?`${typeField}<div class="field"><label for="report-description">O que você viu?</label><textarea id="report-description" name="description" required minlength="20" maxlength="2000" placeholder="Descreva o que aconteceu, quando começou e se há alguém precisando de ajuda.">${esc(S.report.description||'')}</textarea><small>Mínimo de 20 caracteres. Não inclua dados pessoais sensíveis de outras pessoas.</small></div>`:step===2?`<div class="field"><label for="report-neighborhood">Bairro</label><input id="report-neighborhood" name="neighborhood" required minlength="2" maxlength="100" value="${esc(S.report.neighborhood||S.neighborhood)}" placeholder="Ex.: Vila Mariana"></div><div class="field"><label for="report-address">Endereço ou ponto de referência <span class="optional">(opcional)</span></label><input id="report-address" name="address" maxlength="180" value="${esc(S.report.address||'')}" placeholder="Ex.: próximo à escola do bairro"></div><div class="field"><label for="report-date">Quando aconteceu? <span class="optional">(opcional)</span></label><input id="report-date" name="occurred_at" type="datetime-local" value="${esc(S.report.occurred_at||'')}"></div>`:`<div class="field"><span id="urgency-label">Urgência percebida</span><div class="urgency-grid" role="radiogroup" aria-labelledby="urgency-label">${[['2','Baixa'],['3','Média'],['5','Alta']].map(([value,label])=>`<label class="choice"><input type="radio" name="severity" value="${value}" ${String(S.report.severity||3)===value?'checked':''}><span>${label}</span></label>`).join('')}</div><small>O risco final é calculado pelo sistema e analisado pela equipe.</small></div><div class="field"><label for="report-people">Pessoas afetadas <span class="optional">(estimativa opcional)</span></label><input id="report-people" name="affected_people" type="number" min="0" max="100000" value="${esc(S.report.affected_people??0)}"></div><div class="summary"><strong>Resumo do relato</strong>${esc(S.report.type||'Ocorrência')} em ${esc(S.report.neighborhood||S.neighborhood||'bairro não informado')}<br>${esc((S.report.description||'').slice(0,150))}${(S.report.description||'').length>150?'…':''}</div>`;
    return `<div class="report-shell">${pageHead('Participação comunitária','Registrar ocorrência','Leva poucos minutos. Você poderá acompanhar o andamento depois de enviar.')}<div class="progress-label"><span>Etapa ${step} de 3</span><span>${Math.round(step/3*100)}%</span></div><div class="progress-track"><i style="width:${step/3*100}%"></i></div><section class="card report-card"><h2>${stepTitles[step]}</h2><p>${stepText[step]}</p><form id="report-form"><div class="report-fields">${fields}</div><div class="report-actions">${step>1?`<button class="btn btn-secondary" type="button" data-action="report-back">${icon('back',15)} Voltar</button>`:`<a class="btn btn-secondary" href="#inicio">Cancelar</a>`}<button class="btn btn-primary" type="submit">${step===3?'Enviar relato':'Continuar'} ${icon('arrow',15)}</button></div></form></section><p class="explain" style="margin:15px 3px">Em perigo imediato, acione os serviços públicos de emergência. O AlertaBairro é um protótipo acadêmico de acompanhamento comunitário.</p></div>`;
  }
  async function followPage() {
    const all=await getAllOccurrences();
    const mine=all.filter(o=>o.reporter_id===S.user.id);
    return `${pageHead('Seus relatos','Acompanhar','Veja em que etapa estão as ocorrências que você registrou.',`<a href="#registrar" class="btn btn-primary">${icon('plus',17)} Novo relato</a>`)}${mine.length?`<section class="card"><div class="section-head"><div><h2>${mine.length} relato${mine.length===1?'':'s'}</h2><p>As etapas mudam após a análise da equipe.</p></div></div><div class="simple-list">${mine.map(occurrenceItem).join('')}</div></section>`:empty('Nenhum relato ainda','Quando você registrar uma ocorrência, poderá acompanhar a validação e os alertas aqui.',`<a href="#registrar" class="btn btn-primary">Registrar ocorrência</a>`)}<div class="note" style="margin-top:16px">“Recebido” significa que o relato foi salvo. “Em análise” indica que um agente iniciou a verificação. Veja a origem e a confiança no detalhe de cada registro.</div>`;
  }
  async function occurrencesPage() {
    const all=await getAllOccurrences();
    const term=S.search.trim().toLocaleLowerCase('pt-BR');
    const filtered=term?all.filter(o=>[o.title,o.neighborhood,o.type,o.description].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term))):all;
    return `${pageHead('Explorar registros','Ocorrências','Consulte os relatos da comunidade e o estado de cada análise.')}<form id="search-form" class="search-input" role="search" style="margin-bottom:18px">${icon('search',18)}<input name="search" maxlength="100" aria-label="Buscar ocorrências" placeholder="Buscar por bairro ou situação" value="${esc(S.search)}"><button class="btn btn-quiet" type="submit">Buscar</button></form>${filtered.length?`<section class="card"><div class="section-head"><h2>${filtered.length} ocorrência${filtered.length===1?'':'s'}</h2></div><div class="simple-list">${filtered.map(occurrenceItem).join('')}</div></section>`:empty('Nenhum resultado','Tente outra busca ou registre uma nova ocorrência.',`<a href="#registrar" class="btn btn-secondary">Registrar ocorrência</a>`)}`;
  }
  async function mapPage() {
    const all=await getAllOccurrences();
    const groups=Object.entries(all.reduce((acc,o)=>(acc[o.neighborhood]=(acc[o.neighborhood]||0)+1,acc),{})).sort((a,b)=>b[1]-a[1]);
    const pins=all.slice(0,10).map((o,i)=>{const x=12+(num(o.id)*29+i*17)%75,y=19+(num(o.id)*17+i*31)%65;return `<button class="map-pin ${activeStatuses.includes(o.status)?'alert':''}" style="left:${x}%;top:${y}%" data-detail="${esc(o.id)}" aria-label="Ver ${esc(o.title)} em ${esc(o.neighborhood)}">${icon('pin',16)}</button>`}).join('');
    return `${pageHead('Panorama local','Mapa por bairro','Uma vista esquemática dos registros. Consulte o endereço no detalhe de cada ocorrência.')}<section class="card"><div class="map-panel" aria-label="Mapa esquemático de ocorrências">${pins}</div><p class="map-legend">Pontos ilustrativos, sem localização precisa. ${icon('pin',13)} Verde: registro · Vermelho: alerta ativo.</p></section><section class="card" style="margin-top:16px"><div class="section-head"><h2>Registros por bairro</h2></div>${groups.length?`<div class="simple-list">${groups.map(([name,count])=>`<button class="list-item" data-neighborhood="${esc(name)}"><span class="list-icon">${icon('pin',18)}</span><span class="item-main"><span class="item-title">${esc(name)}</span><span class="item-sub">${count} registro${count===1?'':'s'}</span></span><span class="chev">${icon('chevron',16)}</span></button>`).join('')}</div>`:`<p>Nenhuma ocorrência cadastrada.</p>`}</section>`;
  }
  async function sourcesPage() {
    const data=await api('/api/sources');
    const items=data.items||[];
    const labels={community:'Comunidade',external:'Fonte externa',official:'Fonte oficial'};
    return `${pageHead('Transparência','Origem e confiança','Entenda de onde vêm os registros e como o sistema ajuda a priorizar a análise.')}<div class="note" style="margin-bottom:17px">As fontes externas e oficiais desta demonstração são simuladas. Não há atualização automática de dados públicos.</div><div class="grid-3">${items.map(s=>`<article class="card source-card"><span class="source-kind">${esc(labels[s.kind]||s.kind)}</span><h3>${esc(s.name)}</h3><p>${esc(s.description||'Fonte cadastrada.')}</p><div class="source-foot"><span>${esc(s.status||'Cadastrada')}</span><strong>${num(s.occurrences_count)} registro${num(s.occurrences_count)===1?'':'s'}</strong></div></article>`).join('')}</div><div class="grid-2" style="margin-top:17px"><section class="card"><h2>O que significa confiança?</h2><p style="">É uma pontuação de apoio à análise, não uma probabilidade de verdade. Cada detalhe mostra a fonte e o valor calculado.</p><div class="mini-steps"><div class="mini-step"><span class="step-num">1</span><span><strong>Tipo de fonte</strong><p>Relatos comunitários, fontes externas e oficiais têm pesos diferentes.</p></span></div><div class="mini-step"><span class="step-num">2</span><span><strong>Evidências e corroboração</strong><p>Informações adicionais e confirmações independentes elevam o indicador.</p></span></div><div class="mini-step"><span class="step-num">3</span><span><strong>Recência e revisão</strong><p>O tempo desde o evento e a verificação por agente também contam.</p></span></div></div></section><section class="card"><h2>Como o risco é classificado?</h2><p style="">A regra considera o tipo de evento, a gravidade informada e a quantidade estimada de pessoas afetadas. A classificação auxilia a triagem.</p><div class="note warn">Um alerta é sempre uma decisão explícita de agente ou gestor após confirmação; o sistema só então cria notificações internas.</div><a href="#ocorrencias" class="btn btn-secondary" style="margin-top:15px">Explorar ocorrências ${icon('arrow',15)}</a></section></div>`;
  }
  const transitionLabel = to => ({'Em validação':'Iniciar análise','Confirmado':'Confirmar relato','Descartado':'Não confirmar','Alerta emitido':'Enviar alerta','Em monitoramento':'Iniciar acompanhamento','Encerrado':'Marcar como resolvido'})[to] || to;
  const transitionIcon = to => ({'Em validação':'shield','Confirmado':'check','Descartado':'close','Alerta emitido':'bell','Em monitoramento':'activity','Encerrado':'check'})[to] || 'arrow';
  function staffTabs(active) { return `<nav class="workspace-tabs" aria-label="Área do agente"><a href="#fila" class="${active==='fila'?'active':''}">Fila de análise</a><a href="#monitoramento" class="${active==='monitoramento'?'active':''}">Monitoramento</a>${S.user?.role==='gestor'?`<a href="#administracao" class="${active==='administracao'?'active':''}">Administração</a>`:''}</nav>`; }
  function workspaceHead(title,description,active) { return `<div class="workspace-head"><div class="kicker">Área do agente</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${staffTabs(active)}`; }
  function restrictedPage(role='agente') { return `${pageHead('Acesso restrito','Área da equipe','Esta parte da aplicação é reservada aos perfis autorizados.')}<div class="card"><div class="empty"><div class="empty-icon">${icon('shield',22)}</div><h3>Entre como ${esc(role)} para continuar</h3><p>Moradores podem registrar e acompanhar relatos nas telas principais.</p><a href="#inicio" class="btn btn-secondary">Voltar ao Início</a></div></div>`; }
  function transitionForm(to) { const alert=to==='Alerta emitido', discard=to==='Descartado'; return `<form id="transition-form" class="transition-form" data-to="${esc(to)}"><div class="field"><label for="transition-notes">${discard?'Por que o relato não foi confirmado? *':'Nota sobre a decisão'}</label><textarea id="transition-notes" name="notes" maxlength="1000" ${discard?'required minlength="8"':''} placeholder="${discard?'Explique a decisão em pelo menos 8 caracteres.':'Descreva brevemente o que foi verificado.'}"></textarea></div>${alert?`<div class="field"><label for="transition-message">Mensagem para a comunidade *</label><textarea id="transition-message" name="message" required minlength="20" maxlength="500" placeholder="Explique a situação e a orientação para os moradores (mínimo 20 caracteres)."></textarea></div>`:''}<div class="btn-row"><button type="button" class="btn btn-secondary" data-action="cancel-transition">Cancelar</button><button type="submit" class="btn ${discard?'btn-danger':'btn-primary'}">${transitionLabel(to)}</button></div></form>`; }
  async function detailPage() {
    const id=routeId(); if(!/^\d+$/.test(id)) return errorCard('Identificador da ocorrência inválido.');
    const result=await api(`/api/occurrences/${encodeURIComponent(id)}`);
    const o=result.occurrence, history=result.history||[], alert=result.alert;
    const transitions=isStaff()?(S.meta?.transitions?.[o.status]||[]):[];
    const historyHtml=[...history].reverse().map(h=>`<div class="time-item"><strong>${esc(statusLabel(h.to_status))}</strong><small>${dateTime(h.created_at)} · ${esc(h.actor_name||'Sistema')}</small>${h.event?`<p>${esc(h.event)}</p>`:''}${h.notes?`<p>${esc(h.notes)}</p>`:''}</div>`).join('');
    const score=Math.min(100,Math.max(0,num(o.confidence_score)));
    return `<div style="margin-bottom:18px"><a href="#${isStaff()?'fila':'acompanhar'}" class="text-link">${icon('back',15)} Voltar</a></div><div class="detail-head page-head"><div><div class="kicker">Ocorrência #${esc(o.id)} · ${esc(o.neighborhood)}</div><h1>${esc(o.title)}</h1><p>Registrada em ${date(o.created_at)} · ${esc(o.type)}</p></div>${pill(o.status)}</div><div class="detail-grid"><div class="stack"><section class="card"><h2>O que foi relatado</h2><div class="detail-body">${esc(o.description)}</div><div class="info-grid" style="margin-top:17px"><div class="info-cell"><small>Bairro</small><strong>${esc(o.neighborhood)}</strong></div><div class="info-cell"><small>Referência</small><strong>${esc(o.address||'Não informada')}</strong></div><div class="info-cell"><small>Quando</small><strong>${dateTime(o.occurred_at)}</strong></div><div class="info-cell"><small>Pessoas afetadas</small><strong>${num(o.affected_people)}</strong></div></div></section>${alert?`<section class="alert-card"><div class="alert-top"><span class="alert-icon">${icon('bell',18)}</span>${pill(o.status)}</div><div><h3>Alerta enviado à comunidade</h3><p>${esc(alert.message)}</p></div><div class="alert-foot">Publicado em ${dateTime(alert.created_at)}</div></section>`:''}<section class="card"><h2>Andamento</h2><p style="">As mudanças ficam registradas para que todos possam acompanhar as decisões.</p><div class="timeline">${historyHtml||'<p>Nenhuma atualização registrada.</p>'}</div></section></div><aside class="stack"><section class="card"><h2>Origem e confiança</h2><p style="margin-bottom:13px">Fonte: <strong style="color:var(--ink)">${esc(o.source_label||'Comunidade')}</strong></p><div class="section-head" style="margin-bottom:2px"><span style="">Indicador de confiança</span><strong>${score}%</strong></div><div class="confidence-bar"><i style="width:${score}%"></i></div><p class="explain">Esse indicador orienta a análise; ele não garante que um relato seja verdadeiro.</p><details class="details"><summary>Ver critérios e risco</summary><p>Tipo de fonte, evidências (${num(o.evidence_count)}), corroborações (${num(o.corroborations)}), recência e validação por agente compõem a confiança.</p><p>Risco calculado: <strong>${esc(o.risk_level)} (${num(o.risk_score)}/100)</strong>. A regra considera tipo de evento, gravidade e pessoas afetadas.</p><a href="#fontes" class="text-link">Entenda as fontes ${icon('arrow',13)}</a></details></section>${isStaff()?`<section class="card"><h2>Próxima ação</h2><p style="">Estado atual: ${esc(statusLabel(o.status))}. Escolha uma transição e registre o motivo.</p>${transitions.length?`<div class="transition-choice">${transitions.map(to=>`<button class="btn ${to==='Descartado'?'btn-danger':to==='Alerta emitido'?'btn-primary':'btn-secondary'}" data-transition="${esc(to)}">${icon(transitionIcon(to),17)} ${esc(transitionLabel(to))}</button>`).join('')}</div><div id="transition-slot"></div>`:`<div class="note">Não há novas ações para este estado.</div>`}</section>`:''}</aside></div>`;
  }
  async function queuePage() {
    if(!isStaff()) return restrictedPage();
    const all=await getAllOccurrences();
    const waiting=all.filter(o=>['Registrado','Em validação','Confirmado'].includes(o.status));
    const counts={new:all.filter(o=>o.status==='Registrado').length,review:all.filter(o=>o.status==='Em validação').length,ready:all.filter(o=>o.status==='Confirmado').length};
    return `${workspaceHead('Fila de análise','Revise relatos, confirme informações e decida quando avisar a comunidade.','fila')}<div class="stat-strip" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px"><div class="stat"><strong>${counts.new}</strong><span>Recebidos</span></div><div class="stat"><strong>${counts.review}</strong><span>Em análise</span></div><div class="stat"><strong>${counts.ready}</strong><span>Confirmados</span></div></div>${waiting.length?`<div class="workspace-grid">${waiting.map(o=>`<article class="card"><div class="section-head"><span>${pill(o.status)}</span><small style="color:var(--muted)">${date(o.created_at)}</small></div><h3>${esc(o.title)}</h3><p style="">${esc(o.neighborhood)} · ${esc(o.type)}</p><p style="">Risco ${esc(o.risk_level)} · confiança ${num(o.confidence_score)}%</p><button class="btn btn-secondary btn-block" data-detail="${esc(o.id)}">Abrir análise ${icon('arrow',15)}</button></article>`).join('')}</div>`:empty('Fila em dia','Não há registros aguardando análise.')}`;
  }
  async function monitoringPage() {
    if(!isStaff()) return restrictedPage();
    const all=await getAllOccurrences();
    const active=all.filter(o=>activeStatuses.includes(o.status));
    const closed=all.filter(o=>o.status==='Encerrado').slice(0,6);
    return `${workspaceHead('Monitoramento','Acompanhe alertas ativos até que a situação seja resolvida.','monitoramento')}${active.length?`<section class="card"><div class="section-head"><h2>${active.length} caso${active.length===1?'':'s'} ativo${active.length===1?'':'s'}</h2></div><div class="simple-list">${active.map(occurrenceItem).join('')}</div></section>`:empty('Nenhum caso ativo','Casos com alerta enviado ou em acompanhamento aparecerão aqui.')}${closed.length?`<section class="card" style="margin-top:17px"><div class="section-head"><h2>Resolvidos recentemente</h2></div><div class="simple-list">${closed.map(occurrenceItem).join('')}</div></section>`:''}`;
  }
  async function administrationPage() {
    if(S.user?.role!=='gestor') return restrictedPage('gestor');
    const [users,dashboard,health]=await Promise.all([api('/api/users'),api('/api/dashboard'),api('/api/health')]);
    const list=users.items||[];
    return `${workspaceHead('Administração','Visão local da operação e dos perfis de demonstração.','administracao')}<div class="stat-strip" style="margin-bottom:17px"><div class="stat"><strong>${num(dashboard.stats?.total)}</strong><span>Ocorrências</span></div><div class="stat"><strong>${num(dashboard.stats?.active)}</strong><span>Em andamento</span></div><div class="stat"><strong>${num(dashboard.stats?.alerts)}</strong><span>Alertas emitidos</span></div><div class="stat"><strong>${health.status==='ok'?'OK':'?'}</strong><span>API local</span></div></div><section class="card"><div class="section-head"><div><h2>Usuários de demonstração</h2><p>A API verifica a permissão em cada operação.</p></div></div><div class="simple-list">${list.map(u=>`<div class="list-item" style="cursor:default"><span class="avatar">${esc(initials(u.name))}</span><span class="item-main"><span class="item-title">${esc(u.name)}</span><span class="item-sub">${esc(u.email)}</span></span><span class="pill active">${esc(roleLabel(u.role))}</span></div>`).join('')}</div></section><div class="note" style="margin-top:16px">Moradores registram e acompanham. Agentes validam e emitem alertas. Gestores também consultam os usuários locais.</div>`;
  }
  const pages={inicio:homePage,alertas:alertsPage,registrar:reportPage,acompanhar:followPage,ocorrencias:occurrencesPage,mapa:mapPage,fontes:sourcesPage,detalhe:detailPage,fila:queuePage,monitoramento:monitoringPage,administracao:administrationPage};
  async function render() {
    if(!S.user){loginPage();return;}
    S.menu='';S.transitionTo='';
    const previousFocus=document.activeElement?.id;
    const alertFocus=document.activeElement?.dataset?.alertTab;
    const current=++S.renderId;
    const key=pages[route()]?route():'inicio';
    document.title=`${({inicio:'Início',alertas:'Alertas',registrar:'Registrar',acompanhar:'Acompanhar',ocorrencias:'Ocorrências',mapa:'Mapa',fontes:'Origem e confiança',detalhe:'Detalhe',fila:'Fila de análise',monitoramento:'Monitoramento',administracao:'Administração'})[key]} · AlertaBairro`;
    root.innerHTML=shell();
    const main=root.querySelector('#main-content');
    try { const html=await pages[key](); if(current!==S.renderId||!S.user)return; main.innerHTML=html;
      const restored=previousFocus?document.getElementById(previousFocus):null;
      const tabFocus=alertFocus?main.querySelector(`[data-alert-tab="${alertFocus}"]`):null;
      const focusTarget=restored||tabFocus||main.querySelector('h1')||main;
      if(!restored&&!tabFocus)focusTarget.setAttribute('tabindex','-1');
      focusTarget.focus({preventScroll:true});window.scrollTo(0,0); }
    catch(err) { if(current!==S.renderId||!S.user)return; main.innerHTML=errorCard(err.message); }
  }
  async function login(email,password) {
    const button=root.querySelector('#login-form button[type="submit"]');
    if(button){button.disabled=true;button.textContent='Entrando…';}
    try {
      const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      S.token=data.token;S.user=data.user;localStorage.setItem('ab_token',S.token);
      try{S.meta=await api('/api/meta');}catch{S.meta=null;}
      await syncNotices();navigate('inicio');toast(`Bem-vindo, ${firstName(S.user.name)}!`,'success');
    } catch(err) {
      const target=root.querySelector('#login-error');if(target)target.innerHTML=`<div class="form-error">${esc(err.message)}</div>`;
      if(button){button.disabled=false;button.innerHTML=`Entrar ${icon('arrow',18)}`;}
    }
  }
  function captureReport(form) { for(const [key,value] of new FormData(form).entries())S.report[key]=String(value); }
  async function submitReport(form) {
    captureReport(form);
    if(S.reportStep<3){S.reportStep++;render();return;}
    const title=`${S.report.type==='Outro'?'Ocorrência':S.report.type} em ${S.report.neighborhood}`.slice(0,120);
    const body={title,type:S.report.type,description:S.report.description,neighborhood:S.report.neighborhood,address:S.report.address||'',severity:Number(S.report.severity||3),affected_people:Number(S.report.affected_people||0)};
    if(S.report.occurred_at){const parsed=new Date(S.report.occurred_at);if(Number.isNaN(parsed.getTime())){toast('Informe uma data válida.','error');return;}body.occurred_at=parsed.toISOString();}
    const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Enviando…';
    try { const data=await api('/api/occurrences',{method:'POST',body:JSON.stringify(body)});const id=data.occurrence?.id;S.report={};S.reportStep=1;toast('Relato registrado. Você pode acompanhar a análise.','success');navigate(`detalhe/${id}`); }
    catch(err){toast(err.message,'error');button.disabled=false;button.innerHTML=`Enviar relato ${icon('arrow',15)}`;}
  }
  async function submitTransition(form) {
    const to=form.dataset.to;
    const body={to,notes:String(new FormData(form).get('notes')||'').trim()};
    if(to==='Alerta emitido')body.message=String(new FormData(form).get('message')||'').trim();
    const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Salvando…';
    try { const result=await api(`/api/occurrences/${encodeURIComponent(routeId())}/transition`,{method:'POST',body:JSON.stringify(body)});toast(to==='Alerta emitido'?`Alerta enviado. ${num(result.notifications_created)} notificações criadas.`:`Estado atualizado: ${statusLabel(to)}.`,'success');await syncNotices();render(); }
    catch(err){toast(err.message,'error');button.disabled=false;button.textContent=transitionLabel(to);}
  }
  document.addEventListener('submit',event=>{
    const form=event.target;
    if(form.id==='registration-form'){event.preventDefault();registerAccount(form);return;}
    if(form.id==='login-form'){event.preventDefault();const fd=new FormData(form);login(String(fd.get('email')),String(fd.get('password')));}
    if(form.id==='report-form'){event.preventDefault();submitReport(form);}
    if(form.id==='transition-form'){event.preventDefault();submitTransition(form);}
    if(form.id==='search-form'){event.preventDefault();S.search=String(new FormData(form).get('search')||'').slice(0,100);render();}
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='neighborhood-filter'){S.neighborhood=event.target.value;localStorage.setItem('ab_neighborhood',S.neighborhood);render();}
  });
  document.addEventListener('click',async event=>{
    if(event.target.closest('.skip-link')){event.preventDefault();root.querySelector('#main-content')?.focus();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(['more','notices','profile'].includes(action)){setPopover(action);return;}
    if(action==='register-account'){navigate('cadastro');return;}
    if(action==='back-login'){navigate('entrar');return;}
    if(action==='logout'){await logout();return;}
    if(action==='retry'){render();return;}
    if(action==='report-back'){const form=root.querySelector('#report-form');if(form)captureReport(form);S.reportStep=Math.max(1,S.reportStep-1);render();return;}
    if(action==='cancel-transition'){const slot=root.querySelector('#transition-slot');if(slot)slot.innerHTML='';return;}
    const demo=event.target.closest('[data-demo]');if(demo){login(`${demo.dataset.demo}@alertabairro.local`,'Demo@2026');return;}
    const detail=event.target.closest('[data-detail]');if(detail){navigate(`detalhe/${detail.dataset.detail}`);return;}
    const neighborhood=event.target.closest('[data-neighborhood]');if(neighborhood){S.neighborhood=neighborhood.dataset.neighborhood;localStorage.setItem('ab_neighborhood',S.neighborhood);navigate('inicio');return;}
    const tab=event.target.closest('[data-alert-tab]');if(tab){S.alertTab=tab.dataset.alertTab;render();return;}
    const transition=event.target.closest('[data-transition]');if(transition){S.transitionTo=transition.dataset.transition;const slot=root.querySelector('#transition-slot');if(slot){slot.innerHTML=transitionForm(S.transitionTo);slot.scrollIntoView({block:'nearest',behavior:'smooth'});}return;}
    const notice=event.target.closest('[data-notice]');if(notice){const item=S.notices.find(x=>String(x.id)===notice.dataset.notice);try{await api(`/api/notifications/${notice.dataset.notice}/read`,{method:'POST',body:'{}'});await syncNotices();}catch(err){toast(err.message,'error');}if(item?.occurrence_id)navigate(`detalhe/${item.occurrence_id}`);else setPopover('notices');return;}
    if(event.target.closest('#active-popover a[href^="#"]')){root.querySelector('#active-popover')?.remove();S.menu='';return;}
    if(S.menu&&!event.target.closest('#active-popover')){root.querySelector('#active-popover')?.remove();S.menu='';}
  });
  document.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-notice]')){event.preventDefault();event.target.click();}
    if(event.key==='Escape'&&S.menu){const trigger=root.querySelector(`[data-action="${S.menu}"]`);root.querySelector('#active-popover')?.remove();S.menu='';trigger?.setAttribute('aria-expanded','false');trigger?.focus();}
  });
  window.addEventListener('hashchange',()=>{if(location.hash==='#cadastro'){registrationPage();return;}if(location.hash==='#entrar'){loginPage();return;}if(S.user)render();else loginPage();});
  async function init() {
    if(location.hash==='#cadastro'){registrationPage();return;}
    if(!S.token){loginPage();return;}
    root.innerHTML=loading();
    try { const data=await api('/api/auth/me');S.user=data.user;try{S.meta=await api('/api/meta');}catch{S.meta=null;}await syncNotices();render(); }
    catch { clearSession(); }
  }
  init();
})();
