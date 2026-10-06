// Per-control optical displacement. Chromium supports SVG backdrop filters;
// other engines keep translucent highlights and the blur fallback in CSS.
const NS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(NS,'svg');
svg.setAttribute('aria-hidden','true');
svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
const defs = document.createElementNS(NS,'defs');
svg.append(defs); document.body.append(svg);
const supported = /Chrome|Chromium|Edg/.test(navigator.userAgent) && CSS.supports('backdrop-filter','url(#optics)');
let sequence=0;
const managed=new WeakMap();

function displacement(width,height,radius) {
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
  const ctx=canvas.getContext('2d');
  const pixels=ctx.createImageData(canvas.width,canvas.height);
  const halfX=width/2,halfY=height/2;
  const r=Math.min(radius,halfX,halfY);
  const bezel=Math.min(24,halfY*.75);
  for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
    const px=x-halfX,py=y-halfY;
    const qx=Math.abs(px)-halfX+r,qy=Math.abs(py)-halfY+r;
    const ax=Math.max(qx,0),ay=Math.max(qy,0);
    const length=Math.hypot(ax,ay);
    const distance=length+Math.min(Math.max(qx,qy),0)-r;
    let nx=0,ny=0;
    if(length>0){nx=ax/length*Math.sign(px);ny=ay/length*Math.sign(py);}
    else if(qx>qy)nx=Math.sign(px);else ny=Math.sign(py);
    const depth=Math.max(0,Math.min(1,-distance/bezel));
    const bend=distance<=0 && distance>-bezel ? Math.sin(depth*Math.PI)*82 : 0;
    const i=(y*canvas.width+x)*4;
    pixels.data[i]=128-nx*bend;pixels.data[i+1]=128-ny*bend;
    pixels.data[i+2]=128;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);return canvas.toDataURL();
}

export function refreshGlass(root=document) {
  root.querySelectorAll('.glass').forEach(element=>{
    if(managed.has(element))return;
    const id=`optical-${++sequence}`;
    const filter=document.createElementNS(NS,'filter');
    filter.id=id;filter.setAttribute('x','0%');filter.setAttribute('y','0%');
    filter.setAttribute('width','100%');filter.setAttribute('height','100%');
    filter.setAttribute('color-interpolation-filters','sRGB');
    const map=document.createElementNS(NS,'feImage');
    map.setAttribute('result','map');map.setAttribute('preserveAspectRatio','none');
    map.setAttribute('x','0');map.setAttribute('y','0');map.setAttribute('width','100%');map.setAttribute('height','100%');
    const bend=document.createElementNS(NS,'feDisplacementMap');
    bend.setAttribute('in','SourceGraphic');bend.setAttribute('in2','map');
    bend.setAttribute('scale','28');bend.setAttribute('xChannelSelector','R');bend.setAttribute('yChannelSelector','G');
    filter.append(map,bend);defs.append(filter);
    let lastSize='';let frame;
    const update=()=>{
      const {width,height}=element.getBoundingClientRect();
      const size=`${Math.round(width)}:${Math.round(height)}`;
      if(!width||!height||size===lastSize)return;
      lastSize=size;
      const radius=parseFloat(getComputedStyle(element).borderTopLeftRadius)||0;
      map.setAttribute('href',displacement(Math.min(650,width),height,radius));
      if(supported){element.style.setProperty('--glass-filter',`url(#${id})`);element.classList.add('optical');}
    };
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);});
    observer.observe(element);
    element.addEventListener('pointermove',event=>{
      const box=element.getBoundingClientRect();
      element.style.setProperty('--mx',`${(event.clientX-box.left)/box.width*100}%`);
      element.style.setProperty('--my',`${(event.clientY-box.top)/box.height*100}%`);
    },{passive:true});
    element.addEventListener('pointerleave',()=>{element.style.setProperty('--my','0%');});
    managed.set(element,{observer,filter});update();
  });
}
