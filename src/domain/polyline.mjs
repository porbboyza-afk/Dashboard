// Google's encoded-polyline format. Invalid/incomplete data is not a route.
export function decodePolyline(encoded) {
  if (typeof encoded!=='string' || encoded.length>300000) return null;
  let offset=0,lat=0,lng=0;
  const points=[];
  function coordinate() {
    let result=0,shift=0;
    while (offset<encoded.length && shift<=30) {
      const byte=encoded.charCodeAt(offset++)-63;
      if (byte<0 || byte>63) throw new Error('Invalid polyline');
      result|=(byte&31)<<shift;shift+=5;
      if (byte<32) return result&1 ? ~(result>>>1) : result>>>1;
    }
    throw new Error('Truncated polyline');
  }
  try {
    while (offset<encoded.length) {
      lat+=coordinate();lng+=coordinate();
      if (Math.abs(lat)>9000000 || Math.abs(lng)>18000000 || points.length>=30000) return null;
      points.push({lat:lat/100000,lng:lng/100000});
    }
    return points.length>=2?points:null;
  } catch {return null;}
}
