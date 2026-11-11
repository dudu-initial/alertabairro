/* Accessible notification views shared with unit tests; no network side effects. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function filter(items,mode){return items.filter(item=>mode==='unread'?!item.is_read:mode==='read'?!!item.is_read:true);}
  function cards(items,mode,dateTime){
    const selected=filter(items,mode);
    if(!selected.length)return `<div class="empty"><h2>${mode==='unread'?'Você está em dia':mode==='read'?'Nenhuma notificação lida':'Nenhuma notificação ainda'}</h2><p>${mode==='unread'?'Não há avisos aguardando leitura.':'Os avisos aparecem aqui quando a equipe emite um alerta.'}</p><a class="btn btn-secondary" href="#alertas">Consultar alertas</a></div>`;
    return selected.map(item=>`<article class="notification-card ${item.is_read?'':'notification-new'}"><div class="notification-meta"><span class="pill ${item.is_read?'closed':'pending'}">${item.is_read?'Lida':'Não lida'}</span><time>${esc(dateTime(item.created_at))}</time></div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p><div class="notification-context"><span>${esc(item.neighborhood)}</span><span>Risco ${esc(item.risk_level)}</span><span>Confiança ${Number(item.confidence_score)}%</span></div><p class="notification-source">Fonte: ${esc(item.source_label)}</p><div class="notification-actions"><button id="notice-open-${esc(item.id)}" class="btn btn-primary" data-notice="${esc(item.id)}">Ver ocorrência</button>${item.is_read?'':`<button id="notice-read-${esc(item.id)}" class="btn btn-secondary" data-notice-read="${esc(item.id)}">Marcar como lida</button>`}</div></article>`).join('');
  }
  globalThis.AlertaNotifications={filter,cards};
  if(typeof module!=='undefined')module.exports=globalThis.AlertaNotifications;
})();
