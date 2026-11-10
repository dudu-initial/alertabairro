/* Geographic UI. Leaflet 1.9.4 is bundled locally; only street tiles use the network. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\bvl\.?\s+/g,'vila ').replace(/\bjd\.?\s+/g,'jardim ').replace(/\s+/g,' ');
  const aliases = {'arthur alvim':'artur alvim','sao miguel paulista':'sao miguel'};
  const lookup = (places, value) => places.find(p => key(p.name) === (aliases[key(value)] || key(value)));
  const hasPoint = o => o.latitude !== null && o.latitude !== '' && o.latitude !== undefined && o.longitude !== null && o.longitude !== '' && o.longitude !== undefined && Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude));
  const inRegion = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= -24.1 && lat <= -23.3 && lng >= -46.9 && lng <= -46.3;
  const isAlert = o => ['Alerta emitido','Em monitoramento'].includes(o.status);
  const filter = (items, risk, scope, neighborhood) => items.filter(o => (!risk || o.risk_level === risk) && (!neighborhood || o.neighborhood === neighborhood) && (scope === 'all' || (scope === 'alerts' ? isAlert(o) : !['Encerrado','Descartado'].includes(o.status))));
  const risks = {'Baixo':['low','B'],'Moderado':['moderate','M'],'Alto':['high','A'],'Crítico':['critical','C']};
  const riskBadge = risk => `<span class="risk-tag risk-${risks[risk]?.[0] || 'low'}">Risco ${esc(risk)}</span>`;
  let map = null, generation = 0;
  function destroy() { generation++; if (map) { map.remove(); map = null; } }
  function create(id, messageId) {
    destroy();
    const status = document.getElementById(messageId);
    if (!globalThis.L) { status.textContent = 'Mapa indisponível. Consulte os relatos na lista ou continue sem marcar um ponto.'; return null; }
    map = L.map(id, {scrollWheelZoom:false, zoomControl:false, maxBounds:[[-24.2,-47],[-23.2,-46.2]], maxBoundsViscosity:0.8}).setView([-23.5505,-46.6333],11);
    L.control.zoom({position:'bottomright',zoomInTitle:'Aproximar',zoomOutTitle:'Afastar'}).addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      minZoom:10, maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);
    let failed = false;
    tiles.on('tileerror', () => { failed = true; status.textContent = 'Algumas ruas não carregaram. Verifique a conexão. Os relatos continuam disponíveis abaixo.'; });
    tiles.on('loading', () => { failed = false; });
    tiles.on('load', () => { if (!failed) status.textContent = 'Mapa de ruas carregado. Arraste para explorar e use + ou − para aproximar.'; });
    const container = map.getContainer();
    container.setAttribute('aria-label', id === 'risk-map' ? 'Mapa de riscos de São Paulo. Use as setas para mover ou consulte a lista abaixo.' : 'Escolha o local. Use as setas para mover e o botão Marcar no centro, ou toque no mapa.');
    return map;
  }
  function locate(onSuccess, status) {
    const current = generation;
    if (!navigator.geolocation) { status.textContent = 'Seu navegador não oferece localização. Escolha o ponto pelo mapa.'; return; }
    status.textContent = 'Buscando sua localização…';
    navigator.geolocation.getCurrentPosition(position => {
      if (current !== generation) return;
      const {latitude, longitude} = position.coords;
      if (!inRegion(latitude,longitude)) { status.textContent = 'Você está fora da região atendida. Escolha um local em São Paulo.'; return; }
      onSuccess([latitude,longitude]);
      status.textContent = `Localização aproximada encontrada (precisão informada: ${Math.round(position.coords.accuracy)} m). Confira o ponto.`;
    }, () => { if (current === generation) status.textContent = 'Não foi possível obter sua localização. Você pode escolher o local pelo mapa.'; }, {enableHighAccuracy:false,timeout:10000,maximumAge:60000});
  }
  function mountMap(items, statusLabel) {
    const instance = create('risk-map','map-status');
    const markers = instance ? L.featureGroup().addTo(instance) : null;
    const risk = document.getElementById('map-risk'), scope = document.getElementById('map-scope'), neighborhood = document.getElementById('map-neighborhood');
    function update() {
      const selected = filter(items, risk.value, scope.value, neighborhood.value);
      markers?.clearLayers();
      const positioned = selected.filter(hasPoint);
      document.getElementById('map-count').textContent = `${selected.length} relato(s) nesta seleção · ${positioned.length} no mapa`;
      document.getElementById('unlocated-note').textContent = selected.length > positioned.length ? `${selected.length-positioned.length} relato(s) sem ponto informado: consulte na lista. A ausência de registros não garante ausência de risco.` : 'Os pontos são locais informados, sujeitos à validação. A ausência de registros não garante ausência de risco.';
      document.getElementById('map-results').innerHTML = selected.length ? selected.map(o => `<article class="map-result"><div>${riskBadge(o.risk_level)} ${isAlert(o)?'<span class="map-alert-label">Alerta ativo</span>':''}<h3><a href="#detalhe/${esc(o.id)}">${esc(o.title)}</a></h3><p>${esc(o.neighborhood)} · ${esc(statusLabel(o.status))}</p><small>${hasPoint(o)?'Local informado':'Sem ponto no mapa'} · Confiança ${Number(o.confidence_score)}%</small></div><a class="btn btn-secondary" href="#detalhe/${esc(o.id)}">Detalhes</a></article>`).join('') : '<div class="empty"><h3>Nenhum relato nesta seleção</h3><p>Escolha outro bairro ou limpe os filtros.</p></div>';
      if (!instance) return;
      for (const o of positioned) {
        const [tone,letter] = risks[o.risk_level] || risks.Baixo;
        const title = `${o.type}, risco ${o.risk_level}, ${o.neighborhood}, ${statusLabel(o.status)}`;
        const marker = L.marker([Number(o.latitude),Number(o.longitude)], {title,alt:title,keyboard:true,icon:L.divIcon({className:'risk-marker',html:`<span class="risk-dot risk-${tone}">${letter}${isAlert(o)?'<b aria-hidden="true">!</b>':''}</span>`,iconSize:[44,44],iconAnchor:[22,44],popupAnchor:[0,-42]})}).addTo(markers);
        marker.bindPopup(`<div class="risk-popup">${riskBadge(o.risk_level)}<h3>${esc(o.title)}</h3><p>${esc(o.neighborhood)}<br>${esc(statusLabel(o.status))}${isAlert(o)?' · Alerta ativo':''}</p><p>Confiança: <strong>${Number(o.confidence_score)}%</strong><br>Fonte: ${esc(o.source_label)}</p><small>Local informado; pode ser aproximado. Os registros iniciais são demonstrativos.</small><a class="btn btn-primary" href="#detalhe/${esc(o.id)}">Ver ocorrência</a></div>`,{maxWidth:270});
      }
      if (positioned.length) instance.fitBounds(markers.getBounds(),{padding:[35,35],maxZoom:15,animate:false});
      else instance.setView([-23.5505,-46.6333],11,{animate:false});
    }
    for (const element of [risk,scope,neighborhood]) element.addEventListener('change',update);
    document.getElementById('map-reset').onclick = () => { risk.value='';scope.value='open';neighborhood.value='';update(); };
    document.getElementById('map-locate').onclick = () => { if(instance) locate(point => instance.setView(point,16),document.getElementById('map-status')); };
    update();
  }
  function mountPicker(report, places) {
    const input = document.getElementById('report-neighborhood'), list = document.getElementById('place-suggestions'), feedback = document.getElementById('place-feedback');
    const instance = create('report-map','report-map-status');
    const pointStatus = document.getElementById('point-status');
    let marker = null, suggestions = [], active = -1;
    function choose(place, recenter=true) {
      input.value=place.name;input.setCustomValidity('');report.neighborhood=place.name;
      feedback.textContent=`${place.name} · ${place.kind} de São Paulo. Nome conferido em ${place.source}.`;
      hide();
      if (instance && recenter && place.center && !hasPoint(report)) instance.setView(place.center,14);
    }
    function hide() {list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
    function suggest() {
      input.setCustomValidity('');const term=key(input.value);
      suggestions=places.filter(p=>key(p.name).includes(term)).slice(0,8);active=-1;
      list.innerHTML=suggestions.map((p,i)=>`<li id="place-option-${i}" role="option" aria-selected="false" data-place-index="${i}"><strong>${esc(p.name)}</strong><small>${esc(p.kind)} · São Paulo</small></li>`).join('');
      list.hidden=!suggestions.length;input.setAttribute('aria-expanded',String(!!suggestions.length));input.removeAttribute('aria-activedescendant');
      feedback.textContent=suggestions.length?'Escolha uma sugestão ou digite o nome completo.':'Nome não encontrado. Tente o distrito da região; a base não inclui todos os nomes populares.';
    }
    input.addEventListener('input',suggest);input.addEventListener('focus',suggest);
    input.addEventListener('blur',()=>{const place=lookup(places,input.value);if(place)choose(place);else hide();});
    list.addEventListener('pointerdown',event=>{const item=event.target.closest('[data-place-index]');if(item){event.preventDefault();choose(suggestions[Number(item.dataset.placeIndex)]);}});
    list.addEventListener('click',event=>{const item=event.target.closest('[data-place-index]');if(item)choose(suggestions[Number(item.dataset.placeIndex)]);});
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){hide();return;}
      if(['ArrowDown','ArrowUp'].includes(event.key)){
        event.preventDefault();if(list.hidden)suggest();if(!suggestions.length)return;
        active=(active+(event.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;
        Array.from(list.children).forEach((item,i)=>item.setAttribute('aria-selected',String(i===active)));
        input.setAttribute('aria-activedescendant',`place-option-${active}`);list.children[active].scrollIntoView({block:'nearest'});
      }
      if(event.key==='Enter'&&active>=0&&!list.hidden){event.preventDefault();choose(suggestions[active]);}
    });
    function setPoint(point) {
      if(!inRegion(Number(point[0]),Number(point[1]))){if(marker&&hasPoint(report))marker.setLatLng([report.latitude,report.longitude]);pointStatus.textContent='Marque um local na região de São Paulo.';return;}
      report.latitude=Number(point[0]);report.longitude=Number(point[1]);
      if (instance) {
        if(marker)marker.setLatLng(point);
        else marker=L.marker(point,{draggable:true,keyboard:true,title:'Local do relato. Arraste para ajustar.',icon:L.divIcon({className:'risk-marker',html:'<span class="chosen-point">+</span>',iconSize:[44,44],iconAnchor:[22,44]})}).addTo(instance).on('dragend',()=>{const p=marker.getLatLng();setPoint([p.lat,p.lng]);});
      }
      document.getElementById('report-latitude').value=report.latitude.toFixed(6);
      document.getElementById('report-longitude').value=report.longitude.toFixed(6);
      pointStatus.textContent='Ponto marcado. Confira se ele corresponde ao bairro e ao local do ocorrido.';
    }
    if(hasPoint(report)){setPoint([report.latitude,report.longitude]);instance?.setView([report.latitude,report.longitude],16);}
    const existing=lookup(places,input.value);if(existing)choose(existing);
    instance?.on('click',event=>setPoint([event.latlng.lat,event.latlng.lng]));
    document.getElementById('point-center').onclick=()=>{if(instance){const p=instance.getCenter();setPoint([p.lat,p.lng]);}};
    document.getElementById('point-locate').onclick=()=>locate(point=>{instance?.setView(point,16);setPoint(point);},document.getElementById('report-map-status'));
    document.getElementById('point-clear').onclick=()=>{
      if(marker){marker.remove();marker=null;}delete report.latitude;delete report.longitude;
      document.getElementById('report-latitude').value='';document.getElementById('report-longitude').value='';pointStatus.textContent='Sem ponto marcado. O relato ficará disponível na lista.';
    };
    document.getElementById('point-coordinates').onclick=()=>{
      const lat=document.getElementById('report-latitude').value, lng=document.getElementById('report-longitude').value;
      if(!lat||!lng){pointStatus.textContent='Preencha as duas coordenadas.';return;}
      setPoint([Number(lat),Number(lng)]);if(inRegion(Number(lat),Number(lng)))instance?.setView([Number(lat),Number(lng)],16);
    };
  }
  function neighborhoodField(value) {
    return `<div class="field place-field"><label for="report-neighborhood">Bairro ou distrito de São Paulo</label><input id="report-neighborhood" name="neighborhood" required minlength="2" maxlength="100" value="${esc(value)}" placeholder="Digite o nome do bairro" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="place-suggestions" aria-describedby="place-feedback" autocomplete="off"><ul id="place-suggestions" class="place-suggestions" role="listbox" aria-label="Bairros de São Paulo" hidden></ul><small id="place-feedback" aria-live="polite">Sugestões do IBGE e OpenStreetMap. Corrigimos maiúsculas e acentos.</small><small>Base: IBGE e © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>.</small></div>`;
  }
  function pickerFields(report) {
    return `<section class="location-picker" aria-labelledby="location-title"><h3 id="location-title">Onde aconteceu? <span class="optional">(opcional)</span></h3><p>Toque no local para marcar. Se preferir, mova o mapa e use “Marcar no centro”.</p><div class="street-map picker-map" id="report-map"></div><small id="report-map-status" role="status">As ruas precisam de conexão com a internet.</small><div class="map-tools"><button type="button" class="btn btn-primary" id="point-center">Marcar no centro</button><button type="button" class="btn btn-secondary" id="point-locate">Usar minha localização</button><button type="button" class="btn btn-quiet" id="point-clear">Remover ponto</button></div><p id="point-status" role="status">Sem ponto marcado. O relato ficará disponível na lista.</p><details class="details"><summary>Informar coordenadas</summary><div class="coordinate-fields"><div class="field"><label for="report-latitude">Latitude</label><input id="report-latitude" name="latitude" type="number" step="any" min="-24.1" max="-23.3" value="${esc(report.latitude??'')}"></div><div class="field"><label for="report-longitude">Longitude</label><input id="report-longitude" name="longitude" type="number" step="any" min="-46.9" max="-46.3" value="${esc(report.longitude??'')}"></div></div><button type="button" class="btn btn-secondary" id="point-coordinates">Aplicar coordenadas</button></details><small>O ponto enviado será visível para outros usuários. Marque o local da ocorrência.</small></section>`;
  }
  function mapFields(items, selectedNeighborhood) {
    const names=[...new Set(items.map(o=>o.neighborhood))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    return `<section class="map-workspace"><div class="map-filters"><div class="field"><label for="map-neighborhood">Bairro</label><select id="map-neighborhood"><option value="">Todos os bairros</option>${names.map(name=>`<option ${name===selectedNeighborhood?'selected':''}>${esc(name)}</option>`).join('')}</select></div><div class="field"><label for="map-risk">Risco</label><select id="map-risk"><option value="">Todos os riscos</option>${Object.keys(risks).map(r=>`<option>${r}</option>`).join('')}</select></div><div class="field"><label for="map-scope">Mostrar</label><select id="map-scope"><option value="open">Em andamento</option><option value="alerts">Alertas ativos</option><option value="all">Também encerrados</option></select></div></div><div class="map-tools"><button class="btn btn-secondary" id="map-locate" type="button">Perto de mim</button><button class="btn btn-quiet" id="map-reset" type="button">Limpar filtros</button></div><div class="street-map" id="risk-map"></div><p class="map-status" id="map-status" role="status">Carregando ruas… A lista de relatos está disponível abaixo.</p><div class="risk-legend" aria-label="Legenda de riscos">${Object.keys(risks).map(riskBadge).join('')}<span><b>!</b> Alerta ativo</span></div></section><section class="card map-list"><div class="section-head"><h2>Relatos da região</h2><a href="#registrar" class="text-link">Registrar</a></div><p id="map-count" role="status"></p><p id="unlocated-note" class="explain"></p><div id="map-results"></div></section><p class="explain">Os dados iniciais são demonstrativos. O mapa exibe registros da aplicação e não oferece trânsito ao vivo ou rotas seguras.</p>`;
  }
  globalThis.AlertaGeo={key,lookup,hasPoint,inRegion,filter,riskBadge,mountMap,mountPicker,destroy,neighborhoodField,pickerFields,mapFields};
  if(typeof module!=='undefined')module.exports=globalThis.AlertaGeo;
})();
