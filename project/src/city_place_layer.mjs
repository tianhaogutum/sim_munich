// One marker source for the full catalog; specialized district cards stay separate.
export const PLACE_TYPE_LABELS=Object.freeze({park:'公园',square:'广场', 'historic-building':'历史建筑',culture:'文化场馆','public-art':'公共艺术','community-landmark':'社区地标'});
export function cityPlacesGeoJSON(places, found = {}) {
  return {type:'FeatureCollection', features:places.map(place => ({type:'Feature',
    geometry:{type:'Point',coordinates:[place.lon,place.lat]},
    properties:{id:place.id,name:place.name,district:place.district,type:place.type??'',visited:Object.hasOwn(found,place.id)}
  }))};
}
export function installCityPlaceLayer(map, {places, Popup, onTravel, onNavigate, document:doc=globalThis.document}) {
  const source='city-catalog', points='city-catalog-points', labels='city-catalog-labels';
  const byId=new Map(places.map(place=>[place.id,place]));
  let popup, disposed=false, previous='';
  map.addSource(source,{type:'geojson',data:cityPlacesGeoJSON(places)});
  map.addLayer({id:points,type:'circle',source,minzoom:10,paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],10,3,18,7],
    'circle-color':['case',['get','visited'],'#91cfa9','#e8c687'],
    'circle-stroke-color':'#213b3c','circle-stroke-width':2
  }});
  map.addLayer({id:labels,type:'symbol',source,minzoom:15,layout:{
    'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-anchor':'top','text-offset':[0,1]
  },paint:{'text-color':'#213b3c','text-halo-color':'#fff5dc','text-halo-width':2}});
  function showPlace(id) {
    const place=byId.get(id);if(disposed||!place)return false;
    const card=doc.createElement('article');card.className='ci-place-card';
    const append=(tag,text)=>{const el=doc.createElement(tag);el.textContent=text;card.append(el);return el;};
    append('h3',place.name);append('p',place.description??'');
    if(place.type)append('small',`${place.district} · ${PLACE_TYPE_LABELS[place.type]??place.type} · ${place.arrivalRadius} 米内抵达`);
    if(place.explorationHint)append('p',`探索提示：${place.explorationHint}`);
    append('small',place.access??'近似室外导航点；请沿公共步道抵达，以现场围挡为准。');
    const link=append('a','地点资料 ↗');link.href=place.source;link.target='_blank';link.rel='noopener noreferrer';
    const walk=append('button','设为步行目标');walk.type='button';walk.onclick=()=>{onNavigate?.(place);popup?.remove();};
    const travel=append('button','快速前往');travel.type='button';travel.onclick=()=>{popup?.remove();void onTravel(place);};
    popup?.remove();popup=new Popup({maxWidth:'320px',offset:12}).setLngLat([place.lon,place.lat]).setDOMContent(card).addTo(map);
    return true;
  }
  const click=event=>showPlace(event.features?.[0]?.properties?.id);
  const enter=()=>{map.getCanvas().style.cursor='pointer';},leave=()=>{map.getCanvas().style.cursor='';};
  map.on('click',points,click);map.on('mouseenter',points,enter);map.on('mouseleave',points,leave);
  return {showPlace,update(found){const key=Object.keys(found).sort().join('|');if(disposed||key===previous)return;previous=key;map.getSource(source)?.setData(cityPlacesGeoJSON(places,found));},
    dispose(){if(disposed)return;disposed=true;popup?.remove();map.off('click',points,click);map.off('mouseenter',points,enter);map.off('mouseleave',points,leave);leave();for(const id of [labels,points])if(map.getLayer(id))map.removeLayer(id);if(map.getSource(source))map.removeSource(source);}
  };
}
