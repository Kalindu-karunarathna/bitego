import type { PickupCoordinates } from "./pickupRoute";

type WebMapInput = {
  apiKey: string;
  mapId: string;
  destination: PickupCoordinates;
  origin: PickupCoordinates | null;
  coordinates: PickupCoordinates[];
  name: string;
  interactive: boolean;
};

/** Isolated Google Maps document. Escape all data before placing it inside a script. */
export function createPickupMapDocument(input: WebMapInput): string {
  const json = JSON.stringify(input).replace(/[<>&\u2028\u2029]/g, (character) =>
    "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0"));
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#map{height:100%;margin:0}body{font:14px sans-serif;background:#ede8dd;color:#795548}#message{padding:24px}</style></head>
<body><div id="map"><div id="message" role="status">Loading pickup map...</div></div>
<script>
let data = ${json};
let redraw = () => {};
window.addEventListener('message', event => {
  if(event.source !== parent || event.data?.type !== 'bitego-pickup-map') return;
  data = {...data,...event.data.payload}; redraw();
});
const fail = () => { document.getElementById('map').textContent = 'The map could not load. Please try again.'; };
const timeout = setTimeout(fail, 15000);
window.gm_authFailure = () => { clearTimeout(timeout); fail(); };
window.initPickupMap = async () => {
  try {
    const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
      google.maps.importLibrary('maps'), google.maps.importLibrary('marker')
    ]);
    clearTimeout(timeout);
    const point = p => ({lat:p.latitude,lng:p.longitude});
    const map = new Map(document.getElementById('map'), {
      center:point(data.destination),zoom:15,mapId:data.mapId,
      gestureHandling:data.interactive?'cooperative':'none',
      disableDefaultUI:!data.interactive,keyboardShortcuts:data.interactive,
      clickableIcons:false,streetViewControl:false,mapTypeControl:false
    });
    let markers=[]; let line;
    const addMarker=(position,title,color)=>{
      const pin=new PinElement({background:color,borderColor:'#ffffff',glyphColor:'#ffffff'});
      const item=new AdvancedMarkerElement({map,position:point(position),title}); item.append(pin); markers.push(item);
    };
    redraw = () => {
    markers.forEach(item=>item.map=null); markers=[]; if(line)line.setMap(null);
    addMarker(data.destination,data.name,'#E65100');
    if(data.origin) addMarker(data.origin,'Your location','#1976D2');
    if(data.coordinates.length) line=new google.maps.Polyline({map,path:data.coordinates.map(point),strokeColor:'#E65100',strokeWeight:5});
    const points = [data.destination,...(data.origin?[data.origin]:[]),...data.coordinates];
    if(points.length>1) {
      const bounds=new google.maps.LatLngBounds(); points.forEach(p=>bounds.extend(point(p)));
      map.fitBounds(bounds,40);
      google.maps.event.addListenerOnce(map,'idle',()=>{if(map.getZoom()>17)map.setZoom(17);});
    }
    }; redraw();
  } catch { clearTimeout(timeout); fail(); }
};
const script=document.createElement('script');
script.src='https://maps.googleapis.com/maps/api/js?loading=async&v=quarterly&callback=initPickupMap&key='+encodeURIComponent(data.apiKey);
script.async=true; script.onerror=()=>{clearTimeout(timeout);fail();};document.head.append(script);
</script></body></html>`;
}
