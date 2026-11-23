(() => {
  const canvas = document.querySelector('.cinema-field');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const hero = canvas.closest('.care-hero');
  let width=0,height=0,dpr=1,px=0,py=0,tx=0,ty=0,frame=0,visible=true;
  const stars=Array.from({length:85},(_,i)=>({a:i*2.399963,b:(i*0.618033)%1,r:0.5+(i%5)*.32,s:.2+(i%7)*.055}));
  function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,width*dpr);canvas.height=Math.max(1,height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function draw(time){frame=0;if(!visible||document.hidden)return;const t=time/1000;px+=(tx-px)*.05;py+=(ty-py)*.05;ctx.clearRect(0,0,width,height);const cx=width/2,cy=height/2,rad=Math.min(width,height)*.46;
    for(const p of stars){const a=p.a+t*p.s;const z=Math.sin(a+p.b*6.28);const k=1/(1.35-z*.45);const x=cx+(Math.cos(a)*rad*(.55+p.b*.65)+px*18)*k;const y=cy+(Math.sin(a)*rad*.58+Math.cos(p.a)*rad*.27+py*14)*k;ctx.beginPath();ctx.arc(x,y,p.r*k,0,Math.PI*2);ctx.fillStyle=`rgba(${p.b>.65?'185,169,255':'130,238,246'},${.16+.52*(z+1)/2})`;ctx.fill();}
    for(let j=0;j<3;j++){ctx.beginPath();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2+t*.13;const z=Math.sin(a);const k=1/(1.35-z*.38);const x=cx+Math.cos(a)*rad*(1+j*.13)*k+px*12;const y=cy+(Math.sin(a)*rad*.27+Math.cos(a)*rad*(j-1)*.18)*k+py*9;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle=j===1?'#b4a6ff38':'#76ebf333';ctx.lineWidth=1;ctx.stroke();}frame=requestAnimationFrame(draw);}
  function start(){if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(draw);}
  hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();tx=(e.clientX-r.left)/r.width*2-1;ty=(e.clientY-r.top)/r.height*2-1;});hero.addEventListener('pointerleave',()=>{tx=ty=0;});
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  if('IntersectionObserver'in window)new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible&&frame){cancelAnimationFrame(frame);frame=0;}else start();}).observe(hero);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else start();});resize();start();
})();
