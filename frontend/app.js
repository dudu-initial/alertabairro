(() => {
  'use strict';

  const root = document.getElementById('app');
  const toastHost = document.getElementById('toast-host');
  const demoPassword = 'Demo@2026';
  const state = {
    token: localStorage.getItem('ab_token') || '',
    user: null,
    meta: null,
    notifications: [],
    unread: 0,
    routeRun: 0,
    filter: { search: '', status: '', risk: '' },
    page: 1,
    navOpen: false,
    menuOpen: false,
    notificationsOpen: false,
    transitionTo: ''
  };

  const iconPaths = {
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    alert: '<path d="M10.3 3.4 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.3 6.1-6.1 2.3 2.3-6.1 6.1-2.3Z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    flag: '<path d="M4 22V4"/><path d="M4 4c4-3 8 3 12 0v11c-4 3-8-3-12 0"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.8 9a2.3 2.3 0 1 1 3.7 1.9c-1 .8-1.5 1.2-1.5 2.6"/><path d="M12 17h.01"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    location: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 12-2L20 12M4 12l2.4 5a7 7 0 0 0 12-2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v2"/><circle cx="8" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    wifi: '<path d="M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>'
  };
  const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.activity}</svg>`;
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = value => Number(value) || 0;
  const formatDate = value => {
    if (!value) return 'Data não informada';
    const d = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') || String(value).includes('+') ? '' : 'Z'));
    return Number.isNaN(d.getTime()) ? e(String(value).slice(0, 16)) : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  };
  const formatDateTime = value => {
    if (!value) return 'Data não informada';
    const d = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') || String(value).includes('+') ? '' : 'Z'));
    return Number.isNaN(d.getTime()) ? e(String(value).slice(0, 16)) : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
  };
  const statusClass = status => status === 'Confirmado' ? 'confirmed' : status === 'Alerta emitido' ? 'alert' : ['Encerrado','Descartado'].includes(status) ? 'closed' : 'pending';
  const riskClass = risk => ({'Crítico':'critical','Alto':'high','Moderado':'moderate','Baixo':'low'})[risk] || 'low';
  const riskBadge = risk => `<span class="risk-badge risk-${riskClass(risk)}">${e(risk || 'Pendente')}</span>`;
  const statusBadge = status => `<span class="status-badge ${statusClass(status)}">${e(status || 'Registrado')}</span>`;
  const sourceBadge = source => `<span class="source-badge">${icon('layers', 12)} ${e(source || 'Comunidade')}</span>`;
  const confidence = value => `${Math.round(n(value))}%`;
  const idLabel = id => `#${String(id).padStart(4, '0')}`;
  const roleName = role => ({morador:'Morador',agente:'Agente de validação',gestor:'Gestor'})[role] || role || 'Visitante';
  const initials = name => String(name || 'AB').split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();
  const routeName = route => ({dashboard:'Visão geral',mapa:'Mapa',ocorrencias:'Ocorrências',registrar:'Registrar ocorrência',detalhe:'Detalhe da ocorrência',validacao:'Validação',alertas:'Alertas',monitoramento:'Monitoramento',fontes:'Origem & confiança',administracao:'Administração'})[route] || 'Visão geral';
  const route = () => (location.hash || '#dashboard').slice(1).split('/')[0] || 'dashboard';
  const routeId = () => (location.hash || '').slice(1).split('/')[1] || '';
  const nav = [
    {group:'Visão operacional',items:[['dashboard','home','Visão geral'],['mapa','map','Mapa de ocorrências'],['ocorrencias','layers','Ocorrências'],['registrar','plus','Registrar ocorrência']]},
    {group:'Gestão de alertas',items:[['validacao','shield','Fila de validação'],['alertas','bell','Alertas emitidos'],['monitoramento','activity','Monitoramento']]},
    {group:'Transparência',items:[['fontes','target','Origem & confiança'],['administracao','users','Administração']]}
  ];

  async function api(path, options = {}) {
    const headers = { Accept: 'application/json', ...options.headers };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    let response;
    try { response = await fetch(path, { ...options, headers }); }
    catch { throw new Error('Sem conexão com a API. Verifique se o servidor está em execução.'); }
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      if (response.status === 401 && path !== '/api/auth/login') { logout(false); throw new Error('Sua sessão expirou. Entre novamente.'); }
      throw new Error(data.error || data.message || `Falha na solicitação (${response.status}).`);
    }
    return data;
  }
  function toast(message, type = '') {
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
    toastHost.append(el); setTimeout(() => el.remove(), 4200);
  }
  function navigate(destination) { const target = `#${destination}`; if (location.hash === target) render(); else location.hash = target; }
  function logout(showToast = true) {
    state.token = ''; state.user = null; localStorage.removeItem('ab_token');
    renderLogin(); if (showToast) toast('Você saiu da conta.');
  }
  const loading = () => `<div class="loading"><div><div class="spinner"></div>Carregando informações…</div></div>`;
  function errorPanel(message, retry = true) { return `<div class="panel"><div class="empty"><span class="empty-icon">${icon('alert',22)}</span><h3>Não foi possível carregar esta tela</h3><p>${e(message)}</p>${retry ? '<button class="btn btn-outline" data-action="retry">Tentar novamente</button>' : ''}</div></div>`; }
  function emptyPanel(title, description, action = '') { return `<div class="panel"><div class="empty"><span class="empty-icon">${icon('layers',22)}</span><h3>${e(title)}</h3><p>${e(description)}</p>${action}</div></div>`; }

  function shell() {
    const active = route() === 'detalhe' ? 'ocorrencias' : route();
    return `<div class="app-shell ${state.navOpen ? 'nav-open' : ''}"><div class="mobile-scrim" data-action="close-nav"></div><aside class="sidebar" id="main-sidebar" aria-label="Navegação principal">
      <a href="#dashboard" class="brand" aria-label="AlertaBairro, ir para visão geral"><span class="brand-mark">${icon('activity', 23)}</span><span>AlertaBairro<small>Inteligência comunitária</small></span></a>
      ${nav.map(group => `<div class="nav-group-label">${group.group}</div><nav class="nav-group">${group.items.map(([key,ico,label]) => `<a href="#${key}" class="nav-link ${key === active ? 'active' : ''}" ${key === active ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span>${key === 'validacao' && state.pendingCount ? `<span class="nav-badge">${state.pendingCount}</span>` : ''}</a>`).join('')}</nav>`).join('')}
      <div class="sidebar-bottom"><div class="impact-card"><div class="impact-dots"><i></i><i></i><i></i></div><strong>Proteção começa perto.</strong><p>Informação local verificada para decisões mais rápidas e transparentes.</p></div><div class="sidebar-foot">Global Solution FIAP 2026.2</div></div>
    </aside><div class="main-wrap"><header class="topbar"><button class="mobile-menu" data-action="toggle-nav" aria-label="Abrir menu" aria-controls="main-sidebar" aria-expanded="false">${icon('menu', 21)}</button><div class="topbar-title">AlertaBairro <span>/</span> ${routeName(route())}</div><div class="topbar-spacer"></div><form class="topbar-search" id="global-search" role="search">${icon('search', 16)}<input name="search" maxlength="100" aria-label="Buscar ocorrências" placeholder="Buscar ocorrência ou bairro…"></form><button class="top-action" data-action="toggle-notifications" aria-label="Notificações">${icon('bell',17)}${state.unread ? '<span class="dot"></span>' : ''}</button><button class="user-control" data-action="toggle-user" aria-label="Menu de usuário"><span class="avatar">${e(initials(state.user?.name))}</span><span><strong>${e(state.user?.name)}</strong><small>${e(roleName(state.user?.role))}</small></span>${icon('chevron',14)}</button>
    ${state.menuOpen ? `<div class="user-menu"><button data-action="go-admin">${icon('users',15)} Perfil e permissões</button><button data-action="logout">${icon('logout',15)} Sair da conta</button></div>` : ''}
    ${state.notificationsOpen ? notificationPopover() : ''}
    </header><main class="content" id="content">${loading()}</main></div></div>`;
  }
  function notificationPopover() {
    return `<div class="notification-popover"><h3>Notificações ${state.unread ? `<span class="risk-badge risk-high">${state.unread} nova${state.unread === 1 ? '' : 's'}</span>` : ''}</h3>${state.notifications.length ? state.notifications.slice(0,7).map(item => `<div class="notification-item ${item.read_at || item.is_read ? '' : 'unread'}" data-notification="${e(item.id)}" role="button" tabindex="0"><span style="color:var(--teal)">${icon('bell',17)}</span><span><strong>${e(item.title || 'Alerta do bairro')}</strong>${e(item.body || item.message || '')}<small>${formatDateTime(item.created_at)}</small></span></div>`).join('') : '<div class="empty" style="padding:25px"><p>Nenhuma notificação no momento.</p></div>'}<a class="panel-link" href="#alertas" style="display:block;text-align:center;padding:10px">Ver alertas emitidos ${icon('arrow',13)}</a></div>`;
  }
  function renderLogin() {
    document.title = 'Entrar · AlertaBairro';
    root.innerHTML = `<div class="login-page"><section class="login-visual"><div class="brand"><span class="brand-mark">${icon('activity',23)}</span><span>AlertaBairro<small>Inteligência comunitária</small></span></div><div class="login-visual-content"><div class="eyebrow" style="color:#64ddc6">Global Solution FIAP 2026.2</div><h1>O seu bairro <em>mais seguro</em> começa aqui.</h1><p>Registre ocorrências, acompanhe validações e receba alertas com origem e confiança sempre visíveis.</p></div><div class="login-feature"><i></i> Comunidade + tecnologia + resposta responsável</div><svg class="login-illustration" viewBox="0 0 440 330" fill="none" aria-hidden="true"><path d="M5 225 90 170l50 26 92-111 78 30 126-94" stroke="#a5f6de" stroke-width="17" stroke-linecap="round"/><path d="M0 275 95 225l75 70 112-110 144 90" stroke="#a5f6de" stroke-width="12" stroke-linecap="round"/><circle cx="232" cy="85" r="22" fill="#a5f6de"/><circle cx="310" cy="115" r="12" fill="#a5f6de"/></svg></section><section class="login-form-panel"><div class="login-inner"><div class="eyebrow">Bem-vindo de volta</div><h2>Acesse a plataforma</h2><p>Entre com uma conta local de demonstração para explorar os fluxos.</p><form id="login-form"><div class="form-field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="nome@exemplo.com" required></div><div class="form-field"><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required></div><div id="login-error"></div><button class="btn btn-primary" type="submit">Entrar na plataforma ${icon('arrow',16)}</button></form><div class="demo-label">Acesso rápido de demonstração</div><div class="demo-accounts"><button class="demo-account" data-demo="morador"><strong>Morador</strong><small>Registrar e acompanhar</small></button><button class="demo-account" data-demo="agente"><strong>Agente</strong><small>Validar e alertar</small></button><button class="demo-account" data-demo="gestor"><strong>Gestor</strong><small>Visão administrativa</small></button></div><p class="login-foot">Ambiente local de demonstração. Dados de teste são carregados pelo comando de seed.</p></div></section></div>`;
  }

  function pageIntro(kicker, title, subtitle, actions = '') {
    return `<div class="page-intro"><div><div class="eyebrow">${e(kicker)}</div><h1>${e(title)}</h1><p>${e(subtitle)}</p></div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  }
  const newButton = `<a href="#registrar" class="btn btn-primary">${icon('plus',16)} Nova ocorrência</a>`;
  function mapPosition(index, id) {
    const seed = n(id) * 43 + index * 29;
    return { x: 14 + (seed * 17 % 70), y: 20 + (seed * 13 % 62) };
  }
  function mapVisual(items, large = false) {
    const labels = [...new Set(items.map(i => i.neighborhood).filter(Boolean))].slice(0,3);
    return `<div class="map-art" style="${large ? 'height:440px' : ''}"><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="map-road road-d"></div>${labels.map((name,index) => `<span class="map-label l${index+1}">${e(name)}</span>`).join('')}${items.slice(0,12).map((o,index) => {const pos=mapPosition(index,o.id);return `<button class="map-pin ${riskClass(o.risk_level)}" style="left:${pos.x}%;top:${pos.y}%" title="${e(o.title)} — ${e(o.neighborhood)}" aria-label="Ver ${e(o.title)}" data-detail="${e(o.id)}">${icon('location',14)}</button>`}).join('')}</div><div class="map-legend"><span class="legend-item"><i class="legend-dot critical"></i> Crítico</span><span class="legend-item"><i class="legend-dot high"></i> Alto</span><span class="legend-item"><i class="legend-dot moderate"></i> Moderado</span><span class="legend-item"><i class="legend-dot low"></i> Baixo</span><span class="map-note">Distribuição esquemática; endereço completo no detalhe.</span></div>`;
  }
  function occurrenceRow(o) {
    return `<div class="occ-row" data-detail="${e(o.id)}" role="link" tabindex="0"><span class="occ-type-icon">${icon('location',17)}</span><div class="occ-main"><div class="occ-title">${e(o.title)}</div><div class="occ-sub">${e(o.neighborhood)} · ${formatDate(o.created_at)} · ${e(o.source_label || 'Comunidade')} · confiança ${confidence(o.confidence_score)}</div></div>${riskBadge(o.risk_level)}<span class="occ-chevron">${icon('chevron',15)}</span></div>`;
  }
  function statCard(label, value, ico, kind, suffix = '') { return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${kind}">${icon(ico,16)}</span></div><strong>${e(value)}</strong><small>${suffix}</small></div>`; }
  async function dashboardPage() {
    const [dashboard, list] = await Promise.all([api('/api/dashboard'), api('/api/occurrences?limit=100')]);
    const items = list.items || [];
    const stats = dashboard.stats || {};
    state.pendingCount = n(stats.pending);
    const risk = dashboard.by_risk || {};
    const maxRisk = Math.max(1, ...Object.values(risk).map(n));
    return `<section class="hero"><div class="hero-copy"><div class="eyebrow">Plataforma de inteligência comunitária</div><h2>Transformando sinais do bairro em ações de proteção.</h2><p>Uma visão clara das ocorrências, da validação e dos alertas para quem precisa agir.</p></div><div class="hero-graphic"><svg viewBox="0 0 240 180" fill="none" aria-hidden="true"><circle cx="125" cy="87" r="68" stroke="#8be3d5" stroke-opacity=".35"/><circle cx="125" cy="87" r="45" stroke="#8be3d5" stroke-opacity=".5"/><circle cx="125" cy="87" r="23" stroke="#8be3d5"/><path d="M33 119 75 101l32 17 35-60 62 34" stroke="#84d9c9" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 7"/><circle cx="33" cy="119" r="5" fill="#f4bb78"/><circle cx="75" cy="101" r="6" fill="#6bdac3"/><circle cx="142" cy="58" r="7" fill="#f07c69"/><circle cx="204" cy="92" r="5" fill="#6bdac3"/><path d="M123 73v16l11 7" stroke="white" stroke-width="3" stroke-linecap="round"/></svg></div></section>
      <div class="stat-grid">${statCard('Ocorrências',stats.total ?? items.length,'layers','blue','registradas')}${statCard('Em andamento',stats.active ?? 0,'activity','','sob acompanhamento')}${statCard('Aguardando análise',stats.pending ?? 0,'shield','amber','na fila')}${statCard('Alertas emitidos',stats.alerts ?? 0,'bell','red','comunicados')}${statCard('Risco crítico',stats.critical ?? 0,'alert','red','casos prioritários')}</div>
      <div class="dashboard-grid"><div class="dash-col"><section class="panel"><div class="panel-pad"><div class="panel-head"><div><h2>Panorama territorial</h2><p>Ocorrências recentes distribuídas por bairro</p></div><a class="panel-link" href="#mapa">Explorar mapa →</a></div></div>${mapVisual(items)}</section><section class="panel panel-pad"><div class="panel-head"><div><h2>Ocorrências recentes</h2><p>Atualizadas pela comunidade e pela equipe</p></div><a class="panel-link" href="#ocorrencias">Ver todas →</a></div>${items.length ? `<div class="occ-list">${(dashboard.recent || items).slice(0,5).map(occurrenceRow).join('')}</div>` : `<div class="empty"><p>Ainda não há ocorrências registradas.</p>${newButton}</div>`}</section></div>
      <div class="dash-col"><section class="panel panel-pad"><div class="panel-head"><div><h2>Distribuição de risco</h2><p>Classificação das ocorrências registradas</p></div>${icon('filter',17)}</div><div class="risk-bars">${[['Crítico','critical'],['Alto','high'],['Moderado','moderate'],['Baixo','low']].map(([label,cls]) => `<div class="risk-bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.round(n(risk[label])*100/maxRisk)}%"></div></div><strong>${n(risk[label])}</strong></div>`).join('')}</div></section><section class="panel panel-pad"><div class="panel-head"><div><h2>Ação rápida</h2><p>O que você precisa fazer agora?</p></div></div><div class="action-stack">${newButton}<a href="#validacao" class="btn btn-outline">${icon('shield',16)} Ver fila de validação</a><a href="#alertas" class="btn btn-outline">${icon('bell',16)} Consultar alertas</a></div></section><section class="mini-callout">${icon('shield',21)}<div><strong>Dados com contexto e procedência</strong><p>Cada ocorrência exibe fonte, nível de risco, confiança e histórico das decisões.</p><a class="panel-link" href="#fontes" style="display:inline-block;margin-top:9px">Entenda os indicadores →</a></div></section></div></div>`;
  }

  async function mapPage() {
    const result = await api('/api/occurrences?limit=100');
    const items = result.items || [];
    return `${pageIntro('Visão territorial','Mapa de ocorrências','Explore o panorama ilustrativo e abra cada registro para consultar endereço, origem e histórico.',newButton)}<div class="dashboard-grid"><section class="panel"><div class="panel-pad"><div class="panel-head"><div><h2>Pontos monitorados</h2><p>${items.length} ocorrência${items.length===1?'':'s'} registrada${items.length===1?'':'s'}</p></div></div></div>${mapVisual(items,true)}</section><section class="panel panel-pad"><div class="panel-head"><div><h2>Registros no mapa</h2><p>Selecione para ver detalhes e confiança</p></div></div>${items.length ? `<div class="occ-list">${items.slice(0,12).map(occurrenceRow).join('')}</div>` : `<div class="empty"><p>Nenhuma ocorrência no mapa.</p>${newButton}</div>`}</section></div>`;
  }

  function occurrenceTable(items,total,page,limit) {
    const pages = Math.max(1,Math.ceil(total/limit));
    return `<section class="panel"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Ocorrência</th><th>Bairro</th><th>Risco</th><th>Confiança</th><th>Estado</th><th>Atualização</th></tr></thead><tbody>${items.map(o => `<tr data-detail="${e(o.id)}" tabindex="0"><td><div class="table-title">${e(o.title)}</div><div class="table-sub">${idLabel(o.id)} · ${e(o.type)}</div></td><td>${e(o.neighborhood)}</td><td>${riskBadge(o.risk_level)}</td><td><strong>${confidence(o.confidence_score)}</strong></td><td>${statusBadge(o.status)}</td><td>${formatDate(o.updated_at || o.created_at)}</td></tr>`).join('')}</tbody></table></div><div class="table-footer"><span>Mostrando ${items.length} de ${total} registro${total===1?'':'s'} · página ${page} de ${pages}</span><div class="pager"><button type="button" data-page="${page-1}" ${page<=1?'disabled':''} aria-label="Página anterior">‹</button><button type="button" data-page="${page+1}" ${page>=pages?'disabled':''} aria-label="Próxima página">›</button></div></div></section>`;
  }
  async function occurrencesPage() {
    const query = new URLSearchParams({limit:'20',page:String(state.page)});
    for (const [key,value] of Object.entries(state.filter)) if (value) query.set(key,value);
    const result = await api(`/api/occurrences?${query}`);
    const items = result.items || [];
    const statuses = state.meta?.statuses || ['Registrado','Em validação','Confirmado','Alerta emitido','Em monitoramento','Encerrado','Descartado'];
    const risks = state.meta?.risks || ['Baixo','Moderado','Alto','Crítico'];
    return `${pageIntro('Base de registros','Ocorrências','Acompanhe o ciclo completo de cada relato e consulte os critérios de decisão.',newButton)}<form class="toolbar" id="filter-form"><label class="field-search">${icon('search',16)}<input name="search" maxlength="100" aria-label="Buscar registros" placeholder="Buscar por título ou bairro…" value="${e(state.filter.search)}"></label><select name="status" class="select-sm" aria-label="Filtrar por estado"><option value="">Todos os estados</option>${statuses.map(s => `<option value="${e(s)}" ${s===state.filter.status?'selected':''}>${e(s)}</option>`).join('')}</select><select name="risk" class="select-sm" aria-label="Filtrar por risco"><option value="">Todos os riscos</option>${risks.map(s => `<option value="${e(s)}" ${s===state.filter.risk?'selected':''}>${e(s)}</option>`).join('')}</select><button class="btn btn-outline" type="submit">${icon('filter',15)} Aplicar filtros</button></form>${items.length ? occurrenceTable(items,n(result.total),n(result.page),n(result.limit)) : emptyPanel('Nenhuma ocorrência encontrada','Tente ajustar os filtros ou registre uma nova ocorrência.',newButton)}`;
  }

  async function registerPage() {
    const types = state.meta?.types || ['Alagamento','Deslizamento','Incêndio','Queda de árvore','Outro'];
    return `${pageIntro('Participação comunitária','Registrar ocorrência','Descreva o que aconteceu para iniciar a validação. Quanto mais contexto, melhor a análise.')}<div class="form-layout"><section class="panel panel-pad"><div class="panel-head"><div><h2>Dados da ocorrência</h2><p>Campos com * são obrigatórios.</p></div>${icon('file',19)}</div><form id="occurrence-form"><div class="form-grid"><div class="form-field full"><label for="occ-title">Título *</label><input id="occ-title" name="title" required minlength="8" maxlength="120" placeholder="Ex.: Rua alagada após chuva intensa"></div><div class="form-field"><label for="occ-type">Categoria *</label><select id="occ-type" name="type" required><option value="">Selecione a categoria</option>${types.map(t => `<option value="${e(t)}">${e(t)}</option>`).join('')}</select></div><div class="form-field"><label for="occ-date">Data e hora do evento</label><input id="occ-date" name="occurred_at" type="datetime-local"></div><div class="form-field"><label for="occ-neighborhood">Bairro *</label><input id="occ-neighborhood" name="neighborhood" required minlength="2" maxlength="100" placeholder="Ex.: Vila Mariana"></div><div class="form-field"><label for="occ-address">Endereço ou referência</label><input id="occ-address" name="address" maxlength="180" placeholder="Rua, número ou ponto de referência"></div><div class="form-field full"><label for="occ-description">Descrição *</label><textarea id="occ-description" name="description" required minlength="20" maxlength="2000" placeholder="O que aconteceu? Há pessoas afetadas? Quais sinais você observou?"></textarea><small>Evite incluir dados pessoais sensíveis de terceiros.</small></div><div class="form-field"><label for="occ-severity">Gravidade percebida *</label><select id="occ-severity" name="severity" required><option value="">Selecione</option><option value="1">1 — Baixa</option><option value="2">2 — Atenção</option><option value="3">3 — Moderada</option><option value="4">4 — Alta</option><option value="5">5 — Crítica</option></select></div><div class="form-field"><label for="occ-people">Pessoas afetadas (estimativa) *</label><input id="occ-people" name="affected_people" type="number" min="0" max="100000" required value="0"></div></div><div class="form-actions"><a class="btn btn-outline" href="#dashboard">Cancelar</a><button class="btn btn-primary" type="submit">${icon('plus',16)} Registrar ocorrência</button></div></form></section><aside class="dash-col"><div class="panel panel-pad"><div class="panel-head"><div><h2>Como funciona</h2><p>Um fluxo claro, do relato à resolução</p></div></div><div class="steps"><div class="step"><div><strong>Você registra</strong><p>O relato entra na base com origem identificada.</p></div></div><div class="step"><div><strong>A equipe valida</strong><p>Agentes analisam contexto, risco e confiabilidade.</p></div></div><div class="step"><div><strong>O bairro é informado</strong><p>Alertas aprovados geram notificações internas.</p></div></div><div class="step"><div><strong>Seguimos acompanhando</strong><p>O status é atualizado até o encerramento.</p></div></div></div></div><div class="mini-callout">${icon('help',21)}<div><strong>Em situação de perigo imediato</strong><p>Acione os serviços públicos de emergência da sua região. Esta plataforma é um protótipo acadêmico de apoio ao acompanhamento comunitário.</p></div></div></aside></div>`;
  }

  function allowedTransitions(o) {
    if (!['agente','gestor'].includes(state.user?.role)) return [];
    const fallback = {
      'Registrado':['Em validação','Descartado'],
      'Em validação':['Confirmado','Descartado'],
      'Confirmado':['Alerta emitido','Descartado'],
      'Alerta emitido':['Em monitoramento'],
      'Em monitoramento':['Encerrado']
    };
    return (state.meta?.transitions || fallback)[o.status] || [];
  }
  const transitionLabel = to => ({'Em validação':'Iniciar validação','Confirmado':'Confirmar ocorrência','Descartado':'Descartar ocorrência','Alerta emitido':'Emitir alerta','Em monitoramento':'Iniciar monitoramento','Encerrado':'Encerrar ocorrência'})[to] || `Mover para ${to}`;
  const transitionIcon = to => ({'Em validação':'shield','Confirmado':'check','Descartado':'close','Alerta emitido':'bell','Em monitoramento':'activity','Encerrado':'flag'})[to] || 'arrow';
  function historyTimeline(history, occurrence) {
    const entries = [...history].reverse();
    if (!entries.length) entries.push({to_status:'Registrado',event:'Registro comunitário',notes:'Ocorrência enviada pela comunidade.',created_at:occurrence.created_at,actor_name:occurrence.reporter_name});
    return `<div class="timeline">${entries.map(h => `<div class="timeline-item"><strong>${e(h.to_status || h.status || 'Registro')}</strong><small>${formatDateTime(h.created_at)} · ${e(h.actor_name || 'Sistema')}</small>${h.event ? `<p>${e(h.event)}</p>` : ''}${h.notes ? `<p>${e(h.notes)}</p>` : ''}</div>`).join('')}</div>`;
  }
  async function detailPage() {
    const id = routeId();
    if (!id) return errorPanel('Identificador de ocorrência ausente.',false);
    const result = await api(`/api/occurrences/${encodeURIComponent(id)}`);
    const o = result.occurrence || result;
    const history = result.history || [];
    const alert = result.alert;
    const transitions = allowedTransitions(o);
    const isStaff = ['agente','gestor'].includes(state.user?.role);
    return `<div class="page-intro"><div><div class="eyebrow">Registro ${idLabel(o.id)} · ${e(o.neighborhood)}</div><div class="detail-heading"><div><h1>${e(o.title)}</h1><div class="meta-line"><span>${icon('location',13)} ${e(o.address || o.neighborhood)}</span><span>${icon('file',13)} ${e(o.type)}</span><span>${icon('activity',13)} Atualizado em ${formatDate(o.updated_at || o.created_at)}</span></div></div></div></div><div class="actions"><a href="#ocorrencias" class="btn btn-outline">Voltar à lista</a>${statusBadge(o.status)} ${riskBadge(o.risk_level)}</div></div>
      <div class="detail-layout"><div class="dash-col"><section class="panel panel-pad"><h2 class="section-title">Sobre a ocorrência</h2><p class="prose">${e(o.description)}</p><div class="info-grid"><div class="info-tile"><span>Origem</span><strong>${e(o.source_label || 'Relato comunitário')}</strong></div><div class="info-tile"><span>Responsável pelo relato</span><strong>${e(o.reporter_name || 'Comunidade')}</strong></div><div class="info-tile"><span>Registrado em</span><strong>${formatDateTime(o.created_at)}</strong></div><div class="info-tile"><span>Pessoas afetadas</span><strong>${n(o.affected_people)}</strong></div><div class="info-tile"><span>Gravidade informada</span><strong>${n(o.severity)} de 5</strong></div><div class="info-tile"><span>Bairro</span><strong>${e(o.neighborhood)}</strong></div><div class="info-tile"><span>Evidências</span><strong>${n(o.evidence_count)} registro${n(o.evidence_count)===1?'':'s'}</strong></div><div class="info-tile"><span>Corroborações</span><strong>${n(o.corroborations)} confirmação${n(o.corroborations)===1?'':'ões'}</strong></div></div></section>
      ${alert ? `<section class="alert-banner">${icon('bell',21)}<div><strong>Alerta emitido</strong><p>${e(alert.message)}</p><p>Publicado em ${formatDateTime(alert.created_at)} · Público: ${e(alert.audience || 'usuários da plataforma')}</p></div></section>` : ''}
      <section class="panel panel-pad"><div class="panel-head"><div><h2>Histórico de decisões</h2><p>Eventos e responsáveis por cada mudança de estado</p></div>${icon('activity',18)}</div>${historyTimeline(history,o)}</section></div>
      <aside class="dash-col"><section class="panel panel-pad"><div class="panel-head"><div><h2>Risco e confiança</h2><p>Indicadores calculados pelo sistema</p></div>${icon('target',18)}</div><div class="score-row"><span>Classificação de risco</span>${riskBadge(o.risk_level)}</div><div class="score-row"><span>Pontuação de risco</span><strong>${n(o.risk_score)} / 100</strong></div><div class="score-row" style="display:block"><div style="display:flex;justify-content:space-between"><span>Confiança do registro</span><strong>${confidence(o.confidence_score)}</strong></div><div class="confidence-meter"><i style="width:${Math.min(100,Math.max(0,n(o.confidence_score)))}%"></i></div></div><div class="score-row"><span>Fonte</span>${sourceBadge(o.source_label)}</div><a class="panel-link" href="#fontes" style="display:inline-block;margin-top:12px">Entenda a origem e os critérios →</a></section>
      <section class="panel panel-pad"><div class="panel-head"><div><h2>Próxima ação</h2><p>Estado atual: ${e(o.status)}</p></div>${icon('arrow',18)}</div>${transitions.length ? `<div class="action-stack">${transitions.map(to => `<button class="btn ${to === 'Descartado' ? 'btn-danger' : to === 'Alerta emitido' ? 'btn-primary' : 'btn-outline'}" data-transition="${e(to)}">${icon(transitionIcon(to),16)} ${transitionLabel(to)}</button>`).join('')}</div><div id="transition-slot"></div>` : `<div class="inline-message ${isStaff ? 'success' : 'warn'}">${isStaff ? 'Não há mais transições disponíveis para este estado.' : 'A validação e as mudanças de estado são realizadas por agentes autorizados.'}</div>`}</section>
      <section class="mini-callout">${icon('shield',20)}<div><strong>Rastreabilidade do fluxo</strong><p>Origem, classificação e decisões ficam visíveis para dar contexto a cada alerta.</p></div></section></aside></div>`;
  }

  async function validationPage() {
    const result = await api('/api/occurrences?limit=100');
    const all = result.items || [];
    const waiting = all.filter(o => ['Registrado','Em validação','Confirmado'].includes(o.status));
    return `${pageIntro('Operação de campo','Fila de validação','Priorize registros, confira os dados e avance cada ocorrência com justificativa.',`<a href="#fontes" class="btn btn-outline">${icon('target',16)} Critérios de confiança</a>`)}${!['agente','gestor'].includes(state.user?.role) ? `<div class="alert-banner">${icon('lock',21)}<div><strong>Ações reservadas a agentes e gestores</strong><p>Você pode acompanhar a fila; entre com um perfil de agente para validar registros.</p></div></div>` : ''}<div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${statCard('Aguardando triagem',all.filter(o=>o.status==='Registrado').length,'file','amber','registros novos')}${statCard('Em validação',all.filter(o=>o.status==='Em validação').length,'shield','blue','em análise')}${statCard('Confirmadas',all.filter(o=>o.status==='Confirmado').length,'check','','prontas para alerta')}</div>${waiting.length ? `<div class="queue-grid">${waiting.map(o => `<article class="queue-card"><div class="tags">${statusBadge(o.status)}${riskBadge(o.risk_level)}</div><h3>${e(o.title)}</h3><p>${e(o.neighborhood)} · ${e(o.type)} · ${formatDate(o.created_at)}</p><div class="foot"><span>Origem: ${e(o.source_label || 'Comunidade')}</span><strong>Confiança ${confidence(o.confidence_score)}</strong></div><button class="btn btn-outline" data-detail="${e(o.id)}">${icon('chevron',15)} Abrir análise</button></article>`).join('')}</div>` : emptyPanel('Fila em dia','Não há registros aguardando validação neste momento.')}`;
  }

  async function alertsPage() {
    const [alerts, occurrences] = await Promise.all([api('/api/alerts'),api('/api/occurrences?limit=100')]);
    const items = alerts.items || [];
    const ready = (occurrences.items || []).filter(o => o.status === 'Confirmado');
    return `${pageIntro('Comunicação responsável','Alertas emitidos','Comunicados internos gerados a partir de ocorrências confirmadas, com histórico auditável.',`<a href="#validacao" class="btn btn-outline">${icon('shield',16)} Ver validação</a>`)}<div class="alert-banner">${icon('bell',21)}<div><strong>Notificações internas</strong><p>Ao emitir um alerta, o sistema cria notificações para os usuários locais. Esta demonstração não envia SMS ou push externo.</p></div></div>${ready.length && ['agente','gestor'].includes(state.user?.role) ? `<section class="panel panel-pad" style="margin-bottom:18px"><div class="panel-head"><div><h2>Prontas para alerta</h2><p>Ocorrências confirmadas aguardando comunicado</p></div></div><div class="occ-list">${ready.map(occurrenceRow).join('')}</div></section>` : ''}${items.length ? `<div class="card-grid">${items.map(a => `<article class="incident-card"><div class="tags">${riskBadge(a.risk_level)}${statusBadge(a.status || 'Alerta emitido')}</div><h3>${e(a.title || 'Alerta do bairro')}</h3><p>${e(a.message)}</p><div class="foot"><span>${e(a.neighborhood || '')} · ${formatDateTime(a.created_at)}</span><strong>${confidence(a.confidence_score)} confiança</strong></div><button class="btn btn-subtle" style="margin-top:12px" data-detail="${e(a.occurrence_id)}">Ver ocorrência ${icon('arrow',14)}</button></article>`).join('')}</div>` : emptyPanel('Nenhum alerta emitido','Quando uma ocorrência confirmada gerar um alerta, ele aparecerá aqui.')}`;
  }

  async function monitoringPage() {
    const result = await api('/api/occurrences?limit=100');
    const all = result.items || [];
    const monitoring = all.filter(o => ['Alerta emitido','Em monitoramento'].includes(o.status));
    const closed = all.filter(o => o.status === 'Encerrado').slice(0,5);
    return `${pageIntro('Acompanhamento contínuo','Monitoramento','Da emissão do alerta ao encerramento, cada mudança permanece registrada no histórico.',`<a href="#mapa" class="btn btn-outline">${icon('map',16)} Ver mapa</a>`)}<div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${statCard('Alertas ativos',all.filter(o=>o.status==='Alerta emitido').length,'bell','red','aguardam acompanhamento')}${statCard('Em monitoramento',all.filter(o=>o.status==='Em monitoramento').length,'activity','blue','em observação')}${statCard('Encerradas',all.filter(o=>o.status==='Encerrado').length,'check','','histórico concluído')}</div>${monitoring.length ? `<div class="queue-grid">${monitoring.map(o => `<article class="queue-card"><div class="tags">${statusBadge(o.status)}${riskBadge(o.risk_level)}</div><h3>${e(o.title)}</h3><p>${e(o.neighborhood)} · Atualizado ${formatDate(o.updated_at || o.created_at)}</p><div class="foot"><span>${e(o.source_label || 'Comunidade')}</span><strong>${confidence(o.confidence_score)} confiança</strong></div><button class="btn btn-outline" data-detail="${e(o.id)}">${icon('activity',15)} Acompanhar caso</button></article>`).join('')}</div>` : emptyPanel('Nenhum caso ativo','As ocorrências em monitoramento aparecerão aqui.')}${closed.length ? `<section class="panel panel-pad" style="margin-top:19px"><div class="panel-head"><div><h2>Encerramentos recentes</h2><p>Registros concluídos com histórico disponível</p></div></div><div class="occ-list">${closed.map(occurrenceRow).join('')}</div></section>` : ''}`;
  }

  async function sourcesPage() {
    const result = await api('/api/sources');
    const items = result.items || [];
    const kindIcon = kind => ({community:'users',official:'shield',external:'wifi'})[kind] || 'database';
    const kindLabel = kind => ({community:'Comunidade',official:'Fonte oficial',external:'Fonte externa'})[kind] || kind;
    return `${pageIntro('Transparência dos dados','Origem & confiança','Saiba de onde vêm os relatos e como interpretar o grau de confiança de cada ocorrência.')}<div class="source-grid" style="margin-bottom:19px">${items.map(s => `<article class="source-card"><span class="source-icon">${icon(kindIcon(s.kind),20)}</span><div class="eyebrow" style="margin-bottom:7px">${e(kindLabel(s.kind))}</div><h3>${e(s.name)}</h3><p>${e(s.description || 'Fonte cadastrada no sistema.')}</p><div class="foot" style="border-top:1px solid var(--line);padding-top:12px;margin-top:15px;display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#8a9da2"><span>${e(s.status || 'Cadastrada')}</span><strong>${n(s.occurrences_count)} registro${n(s.occurrences_count)===1?'':'s'}</strong></div></article>`).join('') || `<div class="source-card"><h3>Nenhuma fonte cadastrada</h3><p>Fontes adicionadas ao banco serão exibidas aqui.</p></div>`}</div><div class="dashboard-grid"><section class="panel panel-pad"><div class="panel-head"><div><h2>Como ler a confiança</h2><p>Uma referência para interpretar o indicador exibido nos detalhes</p></div>${icon('target',18)}</div><div class="explain-list"><div class="explain-item"><span class="num">1</span><div><strong>Origem do relato</strong>O tipo de fonte contribui para a pontuação e permanece visível no registro.</div></div><div class="explain-item"><span class="num">2</span><div><strong>Evidências e corroborações</strong>Registros adicionais e confirmação independente elevam a confiança.</div></div><div class="explain-item"><span class="num">3</span><div><strong>Recência e verificação</strong>O tempo desde o evento e a validação por agente também entram no cálculo.</div></div></div><div class="inline-message" style="margin-top:17px">A confiança é um indicador calculado, não uma garantia de veracidade. Consulte o histórico antes de agir.</div></section><section class="panel panel-pad"><div class="panel-head"><div><h2>Risco e decisão</h2><p>Sinais para priorização operacional</p></div>${icon('alert',18)}</div><div class="formula"><strong>Classificação de risco</strong><span class="formula-code">Baixo → Moderado → Alto → Crítico</span>O risco combina o tipo de evento, a gravidade informada e o número estimado de pessoas afetadas.</div><p style="font-size:11px;color:#7f9298;line-height:1.7;margin:14px 0 0">A emissão de alerta é uma decisão explícita do agente ou gestor. A notificação interna só é criada após essa transição.</p></section></div>`;
  }

  async function administrationPage() {
    if (state.user?.role !== 'gestor') return `${pageIntro('Gestão da plataforma','Administração','Controle de acesso e visão da operação demonstrativa.')}<div class="panel"><div class="empty"><span class="empty-icon">${icon('lock',22)}</span><h3>Acesso restrito a gestores</h3><p>Entre com a conta de gestor para consultar usuários e permissões desta demonstração.</p></div></div>`;
    const [users,health,summary] = await Promise.all([api('/api/users'),api('/api/health'),api('/api/dashboard')]);
    const items = users.items || [];
    return `${pageIntro('Gestão da plataforma','Administração','Usuários demonstrativos, permissões e saúde da aplicação.',`<button class="btn btn-outline" data-action="retry">${icon('refresh',16)} Atualizar</button>`)}<div class="stat-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${statCard('Usuários cadastrados',items.length,'users','blue','contas locais')}${statCard('Ocorrências',summary.stats?.total || 0,'layers','','no banco')}${statCard('Serviço da API',health.status === 'ok' ? 'Online' : 'Disponível','wifi','','verificação local')}</div><section class="panel" style="margin-bottom:19px"><div class="panel-pad"><div class="panel-head"><div><h2>Contas locais</h2><p>Perfis incluídos para demonstrar as restrições de acesso</p></div></div></div><div class="data-table-wrap"><table class="data-table" style="min-width:600px"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Permissão principal</th></tr></thead><tbody>${items.map(u => `<tr style="cursor:default"><td class="table-title">${e(u.name)}</td><td>${e(u.email)}</td><td>${e(roleName(u.role))}</td><td>${e(({morador:'Registrar e acompanhar',agente:'Validar e emitir alertas',gestor:'Gerir e validar'})[u.role] || 'Consultar')}</td></tr>`).join('')}</tbody></table></div></section><section class="panel panel-pad"><div class="panel-head"><div><h2>Matriz de permissões</h2><p>As restrições são verificadas na API</p></div>${icon('shield',18)}</div><div class="data-table-wrap"><table class="data-table" style="min-width:570px"><thead><tr><th>Ação</th><th>Morador</th><th>Agente</th><th>Gestor</th></tr></thead><tbody><tr style="cursor:default"><td>Registrar ocorrência</td><td>Sim</td><td>Sim</td><td>Sim</td></tr><tr style="cursor:default"><td>Validar e alterar estado</td><td>Não</td><td>Sim</td><td>Sim</td></tr><tr style="cursor:default"><td>Emitir alerta</td><td>Não</td><td>Sim</td><td>Sim</td></tr><tr style="cursor:default"><td>Consultar usuários</td><td>Não</td><td>Não</td><td>Sim</td></tr></tbody></table></div></section>`;
  }

  const pages = {dashboard:dashboardPage,mapa:mapPage,ocorrencias:occurrencesPage,registrar:registerPage,detalhe:detailPage,validacao:validationPage,alertas:alertsPage,monitoramento:monitoringPage,fontes:sourcesPage,administracao:administrationPage};
  async function render() {
    if (!state.user) { renderLogin(); return; }
    state.navOpen = false; state.menuOpen = false; state.notificationsOpen = false; state.transitionTo = '';
    const currentRun = ++state.routeRun;
    const currentRoute = pages[route()] ? route() : 'dashboard';
    document.title = `${routeName(currentRoute)} · AlertaBairro`;
    root.innerHTML = shell();
    const content = document.getElementById('content');
    try {
      const html = await pages[currentRoute]();
      if (currentRun !== state.routeRun || !state.user) return;
      content.innerHTML = html;
      const badge = root.querySelector('.nav-link[href="#validacao"] .nav-badge');
      if (badge) badge.textContent = state.pendingCount || '';
      window.scrollTo({top:0,behavior:'instant'});
    } catch (err) {
      if (currentRun !== state.routeRun || !state.user) return;
      content.innerHTML = errorPanel(err.message);
    }
  }

  async function syncNotifications() {
    if (!state.user) return;
    try {
      const result = await api('/api/notifications');
      state.notifications = result.items || [];
      state.unread = n(result.unread);
      const action = root.querySelector('[data-action="toggle-notifications"]');
      if (action) action.innerHTML = `${icon('bell',17)}${state.unread ? '<span class="dot"></span>' : ''}`;
    } catch { /* A failing notification request should not hide the main application. */ }
  }
  async function syncPendingCount() {
    if (!state.user) return;
    try { const result = await api('/api/dashboard'); state.pendingCount = n(result.stats?.pending); }
    catch { /* The dashboard page will still show its own error if necessary. */ }
  }

  function transitionForm(to) {
    const isAlert = to === 'Alerta emitido';
    const isDiscard = to === 'Descartado';
    return `<form id="transition-form" class="transition-form" data-to="${e(to)}"><label for="transition-notes">${isDiscard ? 'Justificativa do descarte *' : 'Nota da decisão'}</label><textarea id="transition-notes" name="notes" ${isDiscard ? 'required minlength="8"' : ''} placeholder="${isDiscard ? 'Explique por que o relato foi descartado…' : 'Registre os elementos considerados na decisão…'}"></textarea>${isAlert ? `<label for="transition-message">Mensagem do alerta *</label><textarea id="transition-message" name="message" required minlength="20" placeholder="Descreva a situação e a orientação para os moradores (mínimo de 20 caracteres)…"></textarea>` : ''}<div class="actions"><button type="button" class="btn btn-outline" data-action="cancel-transition">Cancelar</button><button type="submit" class="btn ${isDiscard ? 'btn-danger' : 'btn-primary'}">${icon(transitionIcon(to),15)} Confirmar: ${transitionLabel(to)}</button></div></form>`;
  }

  async function login(email,password) {
    const button = root.querySelector('#login-form button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Entrando…'; }
    try {
      const result = await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      state.token = result.token; state.user = result.user; localStorage.setItem('ab_token',state.token);
      try { state.meta = await api('/api/meta'); } catch { state.meta = null; }
      await Promise.all([syncNotifications(),syncPendingCount()]); render(); toast(`Bem-vindo, ${state.user.name.split(' ')[0]}!`,'success');
    } catch (err) {
      const target = root.querySelector('#login-error');
      if (target) target.innerHTML = `<div class="login-error">${e(err.message)}</div>`;
      if (button) { button.disabled = false; button.innerHTML = `Entrar na plataforma ${icon('arrow',16)}`; }
    }
  }
  async function createOccurrence(form) {
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    body.severity = Number(body.severity);
    body.affected_people = Number(body.affected_people);
    if (!body.occurred_at) delete body.occurred_at;
    else {
      const occurredAt = new Date(body.occurred_at);
      if (Number.isNaN(occurredAt.getTime())) { toast('Informe uma data válida.','error'); return; }
      body.occurred_at = occurredAt.toISOString();
    }
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Registrando…';
    try {
      const result = await api('/api/occurrences',{method:'POST',body:JSON.stringify(body)});
      const occurrence = result.occurrence || result;
      await syncPendingCount();
      toast('Ocorrência registrada e enviada para validação.','success');
      navigate(`detalhe/${occurrence.id}`);
    } catch (err) { toast(err.message,'error'); button.disabled = false; button.innerHTML = `${icon('plus',16)} Registrar ocorrência`; }
  }
  async function submitTransition(form) {
    const to = form.dataset.to;
    const fd = new FormData(form);
    const body = {to,notes:String(fd.get('notes') || '').trim()};
    if (to === 'Alerta emitido') body.message = String(fd.get('message') || '').trim();
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Salvando…';
    try {
      const result = await api(`/api/occurrences/${encodeURIComponent(routeId())}/transition`,{method:'POST',body:JSON.stringify(body)});
      toast(to === 'Alerta emitido' ? `Alerta emitido. ${n(result.notifications_created)} notificações criadas.` : `Estado alterado para ${to}.`,'success');
      await Promise.all([syncNotifications(),syncPendingCount()]); render();
    } catch (err) { toast(err.message,'error'); button.disabled = false; button.innerHTML = `Confirmar: ${transitionLabel(to)}`; }
  }

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id === 'login-form') { event.preventDefault(); const fd = new FormData(form); login(String(fd.get('email')),String(fd.get('password'))); }
    if (form.id === 'occurrence-form') { event.preventDefault(); createOccurrence(form); }
    if (form.id === 'transition-form') { event.preventDefault(); submitTransition(form); }
    if (form.id === 'filter-form') { event.preventDefault(); const fd = new FormData(form); const search=String(fd.get('search')||''); if(search.length>100){toast('A busca aceita até 100 caracteres.','error');return;} state.filter = {search,status:String(fd.get('status')||''),risk:String(fd.get('risk')||'')}; state.page=1; render(); }
    if (form.id === 'global-search') { event.preventDefault(); state.filter.search = String(new FormData(form).get('search') || ''); state.page=1; navigate('ocorrencias'); }
  });
  document.addEventListener('click', async event => {
    if (event.target.closest('.sidebar .nav-link, .sidebar .brand')) { root.querySelector('.app-shell')?.classList.remove('nav-open'); root.querySelector('.mobile-menu')?.setAttribute('aria-expanded','false'); }
    const demo = event.target.closest('[data-demo]');
    if (demo) { const role = demo.dataset.demo; login(`${role}@alertabairro.local`,demoPassword); return; }
    const detail = event.target.closest('[data-detail]');
    if (detail) { navigate(`detalhe/${detail.dataset.detail}`); return; }
    const page = event.target.closest('[data-page]');
    if (page && !page.disabled) { state.page=Math.max(1,Number(page.dataset.page)||1); render(); return; }
    const notification = event.target.closest('[data-notification]');
    if (notification) {
      const item = state.notifications.find(x=>String(x.id)===notification.dataset.notification);
      try { await api(`/api/notifications/${notification.dataset.notification}/read`,{method:'POST',body:'{}'}); await syncNotifications(); }
      catch (err) { toast(err.message,'error'); }
      if (item?.occurrence_id) navigate(`detalhe/${item.occurrence_id}`); else { state.notificationsOpen = false; render(); }
      return;
    }
    const transition = event.target.closest('[data-transition]');
    if (transition) { state.transitionTo = transition.dataset.transition; const slot=document.getElementById('transition-slot'); if(slot){slot.innerHTML=transitionForm(state.transitionTo);slot.scrollIntoView({block:'nearest',behavior:'smooth'});} return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-nav') { const isOpen = root.querySelector('.app-shell')?.classList.toggle('nav-open'); const button = root.querySelector('.mobile-menu'); button?.setAttribute('aria-expanded',String(Boolean(isOpen))); button?.setAttribute('aria-label',isOpen?'Fechar menu':'Abrir menu'); if(isOpen) root.querySelector('.sidebar .nav-link')?.focus(); return; }
    if (action === 'close-nav') { root.querySelector('.app-shell')?.classList.remove('nav-open'); const button=root.querySelector('.mobile-menu'); button?.setAttribute('aria-expanded','false'); button?.setAttribute('aria-label','Abrir menu'); button?.focus(); return; }
    if (action === 'toggle-user') { state.menuOpen = !state.menuOpen; state.notificationsOpen = false; root.querySelector('.user-menu')?.remove(); root.querySelector('.notification-popover')?.remove(); if(state.menuOpen) root.querySelector('.topbar')?.insertAdjacentHTML('beforeend',`<div class="user-menu"><button data-action="go-admin">${icon('users',15)} Perfil e permissões</button><button data-action="logout">${icon('logout',15)} Sair da conta</button></div>`); return; }
    if (action === 'toggle-notifications') { state.notificationsOpen = !state.notificationsOpen; state.menuOpen = false; root.querySelector('.user-menu')?.remove(); root.querySelector('.notification-popover')?.remove(); if(state.notificationsOpen) root.querySelector('.topbar')?.insertAdjacentHTML('beforeend',notificationPopover()); return; }
    if (action === 'go-admin') { navigate('administracao'); return; }
    if (action === 'logout') {
      try { await api('/api/auth/logout',{method:'POST',body:'{}'}); }
      catch { /* Clear local state even if the server cannot be reached. */ }
      logout(); return;
    }
    if (action === 'retry') { render(); return; }
    if (action === 'cancel-transition') { const slot=document.getElementById('transition-slot'); if(slot)slot.innerHTML=''; return; }
  });
  document.addEventListener('keydown', event => {
    if ((event.key==='Enter'||event.key===' ') && event.target.matches('[role="link"][data-detail],tr[data-detail],[data-notification]')) {event.preventDefault();event.target.click();}
    if (event.key === 'Escape') { root.querySelector('.app-shell')?.classList.remove('nav-open'); root.querySelector('.user-menu')?.remove(); root.querySelector('.notification-popover')?.remove(); state.menuOpen=false; state.notificationsOpen=false; const button=root.querySelector('.mobile-menu'); button?.setAttribute('aria-expanded','false'); button?.setAttribute('aria-label','Abrir menu'); }
  });
  window.addEventListener('hashchange', () => { if (state.user) render(); });

  async function init() {
    if (!state.token) { renderLogin(); return; }
    root.innerHTML = loading();
    try {
      const result = await api('/api/auth/me'); state.user = result.user;
      try { state.meta = await api('/api/meta'); } catch { state.meta = null; }
      await Promise.all([syncNotifications(),syncPendingCount()]); render();
    } catch { logout(false); }
  }
  init();
})();
