import { projects, projectDetails } from './content.js';

const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const shelf=document.querySelector('#album-shelf');
const grid=document.querySelector('#album-images');
let currentAlbum=projects.find(project=>project.id==='aviation');
const archiveShelf=document.querySelector('#archive-shelf');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const motion=createMotion();
const covers={store:0,products:8,aviation:0,motolex:0};
for(const project of projects){
  const button=document.createElement('button');
  button.type='button';button.className=`album-cover ${project.id}`;
  button.dataset.album=project.id;
  button.setAttribute('aria-label',`Открыть альбом ${project.title}`);
  button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-controls','album-content');
  button.setAttribute('aria-expanded','false');
  button.innerHTML=`<img src="${project.images[covers[project.id]]?.src||project.images[0].src}" alt="" loading="lazy"><span class="cover-label"><span>${project.title}</span><span>${project.images.length} работ</span></span>`;
  const archived=['products','motolex'].includes(project.id);
  button.addEventListener('click',()=>selectAlbum(project));(archived?archiveShelf:shelf).append(button);
}

function selectAlbum(project){
  const archived=['products','motolex'].includes(project.id);
  const content=document.querySelector('#album-content');
  content.hidden=false;
  document.body.classList.toggle('show-colors',archived);
  const toggle=document.querySelector('.color-toggle');toggle.setAttribute('aria-pressed',String(archived));toggle.querySelector('span').textContent=archived?'Без цвета':'Показать в цвете';
  currentAlbum=project;
  document.querySelectorAll('[data-album]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.album===project.id)));
  document.querySelectorAll('[data-album]').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.album===project.id)));
  document.querySelector('#album-title').textContent=project.title;
  document.querySelector('#album-more').dataset.project=project.id;
  document.querySelector('#album-description').textContent=project.description;
  grid.className=`album-images ${project.id}`;grid.replaceChildren();
  project.images.forEach((item,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='image-tile';
    button.style.setProperty('--delay',`${Math.min(index,7)*45}ms`);
    button.setAttribute('aria-label',`Открыть: ${item.caption}`);
    button.innerHTML=`<img src="${item.src}" alt="${item.alt}" loading="lazy"><span class="tile-caption"><span>${item.caption}</span>${icon('arrow')}</span>`;
    button.addEventListener('click',()=>openImages(project,index));grid.append(button);
  });
  motion.observe(grid);
}
selectAlbum(currentAlbum);

const designDialog=document.querySelector('#design-dialog');
const designTrigger=document.querySelector('#open-design');
const collage=document.querySelector('#collage-art');
const collageItems=[projects.find(p=>p.id==='aviation').images[0],projects.find(p=>p.id==='store').images[0],projects.find(p=>p.id==='products').images[8],projects.find(p=>p.id==='motolex').images[0],projects.find(p=>p.id==='aviation').images[1]];
collageItems.forEach((item,index)=>{
  const frame=document.createElement('span');frame.className=`collage-piece collage-piece-${index+1}`;
  const preview=document.createElement('img');preview.src=item.src;preview.alt='';preview.loading='lazy';frame.append(preview);collage.append(frame);
});
function syncModalState(){document.body.classList.toggle('modal-open',!!document.querySelector('dialog[open]'));}
designTrigger.addEventListener('click',()=>{
  designDialog.showModal();syncModalState();motion.observe(designDialog);
  document.querySelector('#close-design').focus({preventScroll:true});
});
document.querySelector('#close-design').addEventListener('click',()=>designDialog.close());
designDialog.addEventListener('close',()=>{syncModalState();designTrigger.focus({preventScroll:true});});
designDialog.addEventListener('click',event=>{
  const box=designDialog.getBoundingClientRect();
  if(event.target===designDialog&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))designDialog.close();
});

const housePhotos={title:'Дом мещан Мироновых',images:[
  {src:'./assets/house-detail-carving.webp',alt:'Детали деревянной резьбы Дома Мироновых',caption:'Деревянная резьба'},
  {src:'./assets/house-night.webp',alt:'Окна и деревянная резьба Дома Мироновых',caption:'Детали фасада'},
  {src:'./assets/house.webp',alt:'Главный фасад Дома Мироновых',caption:'Главный фасад'},
]};
const stills=document.createElement('div');stills.className='house-stills';
housePhotos.images.slice(0,2).forEach((item,i)=>{
  const button=document.createElement('button');button.type='button';button.className='house-still';
  button.setAttribute('aria-label',`Открыть фотографию: ${item.caption}`);
  button.innerHTML=`<img src="${item.src}" alt="${item.alt}" loading="eager"><span class="photo-caption">${item.caption}${icon('arrow')}</span>`;
  button.addEventListener('click',()=>openImages(housePhotos,i));stills.append(button);
});
document.querySelector('.house-media').before(stills);

document.querySelector('.color-toggle').addEventListener('click',event=>{
  const active=document.body.classList.toggle('show-colors');
  event.currentTarget.setAttribute('aria-pressed',String(active));
  event.currentTarget.querySelector('span').textContent=active?'Чёрно-белый просмотр':'Показать в цвете';
});

const dialog=document.querySelector('#media-dialog');
const stage=document.querySelector('.media-stage');
const image=document.querySelector('#gallery-image');
const video=document.querySelector('#gallery-video');
const thumbs=document.querySelector('#gallery-thumbnails');
const previous=document.querySelector('#gallery-prev');
const next=document.querySelector('#gallery-next');
const films=[
  {src:'./assets/flight-orbit.mp4',poster:'./assets/flight-orbit-poster.webp',title:'Дом Мироновых — вокруг здания'},
  {src:'./assets/flight-overview.mp4',poster:'./assets/flight-overview-poster.webp',title:'Дом Мироновых — обзор здания'},
];
let viewing;let index=0;let kind='image';let focusedBefore;

function openDialog(){
  focusedBefore=document.activeElement;
  document.body.classList.add('modal-open');dialog.showModal();
  dialog.scrollTop=0;document.querySelector('#close-dialog').focus({preventScroll:true});
  
}
function showImage(position){
  index=Math.max(0,Math.min(position,viewing.images.length-1));
  const item=viewing.images[index];
  stage.classList.add('loading');document.querySelector('.media-error').hidden=true;
  image.src=item.src;image.alt=item.alt;
  document.querySelector('#gallery-caption').textContent=item.caption;
  document.querySelector('#gallery-counter').textContent=`${index+1} / ${viewing.images.length}`;
  const download=document.querySelector('#download-media');download.href=item.src;download.download=item.src.split('/').pop();
  previous.disabled=index===0;next.disabled=index===viewing.images.length-1;
  thumbs.querySelectorAll('button').forEach((button,i)=>{
    button.classList.toggle('active',i===index);button.setAttribute('aria-pressed',String(i===index));
    if(i===index && dialog.open)button.scrollIntoView({block:'nearest',inline:'nearest'});
  });
}
function openImages(project,position){
  dialog.classList.toggle('original-colors',['products','motolex'].includes(project.id));
  viewing=project;kind='image';video.pause();video.hidden=true;image.hidden=false;
  document.querySelector('#dialog-title').textContent=project.title;
  const single=project.images.length===1;previous.hidden=single;next.hidden=single;thumbs.hidden=single;
  thumbs.replaceChildren();
  project.images.forEach((item,i)=>{
    const button=document.createElement('button');button.type='button';button.className='thumbnail';
    button.setAttribute('aria-label',item.caption);button.innerHTML=`<img src="${item.src}" alt="" loading="eager">`;
    button.addEventListener('click',()=>showImage(i));thumbs.append(button);
  });
  showImage(position);openDialog();
}
image.addEventListener('load',()=>stage.classList.remove('loading'));
image.addEventListener('error',()=>{stage.classList.remove('loading');document.querySelector('.media-error').hidden=false;});
video.addEventListener('loadeddata',()=>stage.classList.remove('loading'));
video.addEventListener('error',()=>{stage.classList.remove('loading');document.querySelector('.media-error').hidden=false;});
document.querySelector('#retry-media').addEventListener('click',()=>{
  document.querySelector('.media-error').hidden=true;stage.classList.add('loading');
  if(kind==='video'){video.load();video.play().catch(()=>stage.classList.remove('loading'));}
  else{const src=image.src;image.removeAttribute('src');image.src=src;}
});
document.querySelectorAll('[data-film]').forEach(button=>button.addEventListener('click',()=>{
  dialog.classList.remove('original-colors');
  const film=films[Number(button.dataset.film)];kind='video';image.hidden=true;video.hidden=false;
  previous.hidden=true;next.hidden=true;thumbs.hidden=true;
  document.querySelector('#dialog-title').textContent=film.title;
  document.querySelector('#gallery-caption').textContent='Видео объёмной модели';
  document.querySelector('#gallery-counter').textContent='0:20';
  document.querySelector('.media-error').hidden=true;stage.classList.add('loading');
  const download=document.querySelector('#download-media');download.href=film.src;download.download=film.src.split('/').pop();
  video.poster=film.poster;video.src=film.src;openDialog();video.play().catch(()=>stage.classList.remove('loading'));
}));
previous.addEventListener('click',()=>showImage(index-1));next.addEventListener('click',()=>showImage(index+1));
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{video.pause();syncModalState();focusedBefore?.focus({preventScroll:true});});
dialog.addEventListener('click',event=>{
  const box=dialog.getBoundingClientRect();
  if(event.target===dialog && (event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))dialog.close();
});
dialog.addEventListener('keydown',event=>{
  if(kind==='image' && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();showImage(index+(event.key==='ArrowRight'?1:-1));}
});

let toastTimer;
document.querySelector('.copy-email').addEventListener('click',async()=>{
  const toast=document.querySelector('#toast');
  try{await navigator.clipboard.writeText('fedin.andrey.v@gmail.com');toast.textContent='Почта скопирована';}
  catch{toast.textContent='fedin.andrey.v@gmail.com';}
  toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500);
});
document.querySelector('#year').textContent=new Date().getFullYear();


const links=[...document.querySelectorAll('.nav-link')];
const lens=document.querySelector('.nav-lens');
function moveLens(link){
  lens.style.width=`${link.offsetWidth}px`;
  const padding=parseFloat(getComputedStyle(link.parentElement).paddingLeft);
  lens.style.transform=`translateX(${link.offsetLeft-padding}px)`;
}
links.forEach(link=>link.addEventListener('pointerenter',()=>moveLens(link)));
let navigationFrame;
let navigationTarget;
function cancelNavigation(){
  cancelAnimationFrame(navigationFrame);navigationFrame=null;
  navigationTarget?.classList.remove('navigation-arriving');navigationTarget=null;
}
links.forEach(link=>link.addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const target=document.querySelector(link.hash);if(!target)return;
  event.preventDefault();cancelNavigation();moveLens(link);
  const padding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
  const from=scrollY;
  const to=Math.max(0,Math.min(from+target.getBoundingClientRect().top-padding,document.documentElement.scrollHeight-innerHeight));
  const finish=()=>{
    navigationFrame=null;history.replaceState(null,'',link.hash);
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
    target.addEventListener('blur',()=>target.removeAttribute('tabindex'),{once:true});
    target.classList.remove('navigation-arriving');navigationTarget=null;
  };
  if(reduceMotion.matches){window.scrollTo({top:to,behavior:'instant'});finish();return;}
  navigationTarget=target;target.classList.add('navigation-arriving');
  const duration=Math.min(1350,650+Math.abs(to-from)*.15);let start;
  function step(now){
    start??=now;const progress=Math.min(1,(now-start)/duration);
    const ease=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
    window.scrollTo({top:from+(to-from)*ease,behavior:'instant'});
    if(progress<1)navigationFrame=requestAnimationFrame(step);else finish();
  }
  navigationFrame=requestAnimationFrame(step);
}));
addEventListener('wheel',cancelNavigation,{passive:true});
addEventListener('touchstart',cancelNavigation,{passive:true});
addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))cancelNavigation();});
reduceMotion.addEventListener('change',cancelNavigation);
document.querySelector('.navigation').addEventListener('pointerleave',()=>moveLens(links.find(link=>link.classList.contains('active'))||links[0]));
const sectionObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
    const selected=links.find(link=>link.hash===`#${entry.target.id}`);
    links.forEach(link=>link.classList.toggle('active',link===selected));if(selected)moveLens(selected);
  }
},{rootMargin:'-20% 0px -50% 0px'});
['work','code','contact'].forEach(id=>sectionObserver.observe(document.getElementById(id)));
new ResizeObserver(()=>moveLens(links.find(link=>link.classList.contains('active'))||links[0])).observe(document.querySelector('.navigation'));

{
  const sculpture=document.querySelector('.sculpture-wrap');let raf;
  document.querySelector('.hero').addEventListener('pointermove',event=>{
    if(reduceMotion.matches||event.pointerType!=='mouse')return;
    cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
      sculpture.style.setProperty('--px',`${(event.clientX/innerWidth-.5)*18}px`);
      sculpture.style.setProperty('--py',`${(event.clientY/innerHeight-.5)*12}px`);
    });
  },{passive:true});
  const reset=()=>{cancelAnimationFrame(raf);sculpture.style.removeProperty('--px');sculpture.style.removeProperty('--py');};
  function alignSculpture(){
    const hero=document.querySelector('.hero').getBoundingClientRect();
    const letter=document.querySelector('.hero-name-back').getBoundingClientRect();
    const width=sculpture.offsetWidth;
    const left=letter.left-hero.left+letter.width*1.35-width*.35;
    sculpture.style.left=`${hero.width<=760?hero.width-width-8:Math.min(hero.width-width*.55,Math.max(hero.width*.36,left))}px`;
    sculpture.style.right='auto';
  }
  document.fonts.ready.then(alignSculpture);
  new ResizeObserver(alignSculpture).observe(document.querySelector('.hero'));
  document.querySelector('.hero').addEventListener('pointerleave',reset);
  reduceMotion.addEventListener('change',reset);
}
addEventListener('scroll',()=>document.querySelector('.site-header').classList.toggle('scrolled',scrollY>100),{passive:true});

const projectDialog=document.querySelector('#project-dialog');
let projectTrigger;
document.querySelectorAll('.project-more').forEach(button=>button.addEventListener('click',()=>{
  const detail=projectDetails[button.dataset.project];
  if(!detail)return;
  projectTrigger=button;
  document.querySelector('#project-dialog-title').textContent=detail.title;
  const content=document.querySelector('#project-dialog-content');content.replaceChildren();
  const intro=document.createElement('p');intro.className='project-dialog-intro';intro.textContent=detail.intro;content.append(intro);
  detail.sections.forEach(([title,text])=>{
    const section=document.createElement('section');const heading=document.createElement('h3');const paragraph=document.createElement('p');
    heading.textContent=title;paragraph.textContent=text;section.append(heading,paragraph);content.append(section);
  });
  document.body.classList.add('modal-open');projectDialog.showModal();projectDialog.scrollTop=0;
  document.querySelector('#close-project').focus({preventScroll:true});
}));
document.querySelector('#close-project').addEventListener('click',()=>projectDialog.close());
projectDialog.addEventListener('close',()=>{syncModalState();projectTrigger?.focus({preventScroll:true});});
projectDialog.addEventListener('click',event=>{
  const box=projectDialog.getBoundingClientRect();
  if(event.target===projectDialog&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))projectDialog.close();
});

const interlude=document.querySelector('.sculpture-interlude');
const objects=[...interlude.querySelectorAll('.interlude-object')];
let interludeFrame;
function resetInterlude(){cancelAnimationFrame(interludeFrame);objects.forEach(object=>object.style.transform='');}
interlude.addEventListener('pointermove',event=>{
  if(reduceMotion.matches||event.pointerType!=='mouse')return;
  cancelAnimationFrame(interludeFrame);interludeFrame=requestAnimationFrame(()=>{
    const box=interlude.getBoundingClientRect();
    const x=(event.clientX-box.left)/box.width-.5,y=(event.clientY-box.top)/box.height-.5;
    objects.forEach((object,i)=>{const depth=4+i*2;object.style.transform=`translate3d(${x*depth}px,${y*depth}px,0)`;});
  });
},{passive:true});
interlude.addEventListener('pointerleave',resetInterlude);
reduceMotion.addEventListener('change',resetInterlude);

// Shared entrance choreography: new project sections inherit these selectors,
// while data-motion="type|title|image|rise" can opt individual elements in.
function createMotion(){
  const seen=new WeakSet();
  const tracked=new Set();
  const active=new Map();
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting){
        if(entry.target.classList.contains('motion-rest')||entry.target.classList.contains('motion-hero-rest'))play(entry.target);
      }else reset(entry.target);
    }
  },{threshold:0});
  function reset(element){
    active.get(element)?.();
    element.classList.toggle(element.dataset.motion==='hero'?'motion-hero-rest':'motion-rest',!reduceMotion.matches);
  }
  function play(element){
    active.get(element)?.();
    element.classList.remove('motion-rest','motion-hero-rest');
    if(reduceMotion.matches||!element.isConnected)return;
    const kind=element.dataset.motion;
    if(kind==='hero')return;
    if(kind==='type'){
      // Preserve native text shaping and spacing; reveal the original text
      // through rectangles measured by Range instead of splitting it into spans.
      const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
      const letters=[];let node;
      while((node=walker.nextNode())){
        let offset=0;
        for(const character of Array.from(node.textContent)){offset+=character.length;letters.push([node,offset]);}
      }
      if(!letters.length)return;
      const properties=['mask-image','mask-size','mask-position','mask-repeat'];
      const saved=properties.map(property=>[property,element.style.getPropertyValue(property),element.style.getPropertyPriority(property)]);
      const range=document.createRange();range.setStart(letters[0][0],0);
      element.classList.add('is-typing');element.style.maskImage='linear-gradient(transparent,transparent)';
      let frame;let start;let previous=-1;
      const finish=()=>{
        cancelAnimationFrame(frame);
        for(const [property,value,priority] of saved){if(value)element.style.setProperty(property,value,priority);else element.style.removeProperty(property);}
        element.classList.remove('is-typing');active.delete(element);
      };
      active.set(element,finish);
      const duration=Math.min(1400,Math.max(480,letters.length*19));
      function tick(now){
        if(reduceMotion.matches||!element.isConnected){finish();return;}
        start??=now;
        const progress=Math.min(1,(now-start)/duration);
        const count=Math.min(letters.length,Math.floor(progress*letters.length/3)*3);
        if(count>0&&count!==previous){
          range.setEnd(...letters[count-1]);
          const box=element.getBoundingClientRect();
          const rects=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);
          element.style.maskImage=rects.map(()=>'linear-gradient(#000,#000)').join(',');
          element.style.maskSize=rects.map(rect=>`${rect.width+1}px ${rect.height+2}px`).join(',');
          element.style.maskPosition=rects.map(rect=>`${rect.left-box.left}px ${rect.top-box.top-1}px`).join(',');
          element.style.maskRepeat='no-repeat';previous=count;
        }
        if(progress===1)finish();else frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);return;
    }
    const image=kind==='image';
    const animation=element.animate([
      {opacity:0,transform:`translateY(${image?28:18}px)`,...(image?{clipPath:'inset(6% 0 0 0)'}:{})},
      {opacity:1,transform:'translateY(0)',...(image?{clipPath:'inset(0)'}:{})}
    ],{duration:image?1000:750,delay:parseFloat(element.style.getPropertyValue('--delay'))||0,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});
    const finish=()=>{animation.cancel();active.delete(element);};
    active.set(element,finish);
    animation.finished.then(()=>{if(active.get(element)===finish)active.delete(element);}).catch(()=>{});
  }
  function observe(root){
    for(const element of tracked)if(!element.isConnected){active.get(element)?.();observer.unobserve(element);tracked.delete(element);}
    const groups={
      hero:'.hero',
      title:'.section-heading h2,.about-heading h2,.project-info h3,.house-info h3,.contact-content h2,#album-title',
      image:'.design-collage,.philosopher-aside,.album-cover,.image-tile,.house-photo,.film-card,.house-still,.interlude-object,.contact-art',
      rise:'.about-copy p,.project-info p:not(.project-status),.house-info p,.city-diagram,.royale-diagram,.contact-telegram,.contact-actions',
      type:'.hero-eyebrow,.hero-intro,.view-hint,.project-status,.city-map-note'
    };
    for(const [kind,selector] of Object.entries(groups))root.querySelectorAll(selector).forEach(element=>{element.dataset.motion??=kind;});
    root.querySelectorAll('[data-motion]').forEach(element=>{
      if(seen.has(element))return;
      seen.add(element);tracked.add(element);reset(element);observer.observe(element);
    });
  }
  reduceMotion.addEventListener('change',()=>{
    for(const element of tracked){
      reset(element);
      if(!reduceMotion.matches){const box=element.getBoundingClientRect();if(box.bottom>0&&box.top<innerHeight&&box.width&&box.height)play(element);}
    }
  });
  return {observe};
}
motion.observe(document);

