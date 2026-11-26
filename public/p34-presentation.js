// All book parts rotate about the same sewn spine. A leaf turns after the board,
// not through it; the same pose function closes the book in reverse.
export function bookPose(progress) {
  const ease = n => { n = Math.min(1, Math.max(0, n)); return n*n*(3-2*n); };
  return {
    cover: ease(progress/.82) * 165*Math.PI/180,
    leaves: [0,1,2,3].map(i => ease((progress-.11-i*.065)/.64)*(163-i*1.4)*Math.PI/180),
    lift: .075*ease(progress), ink: ease((progress-.58)/.4),
  };
}

export function makeBook(T, x, y, z, title, index) {
  const root = new T.Group(), coverPivot = new T.Group(), leaves = [];
  root.name=title;root.position.set(x, y, z);
  root.userData.presentation = true;
  const cloth = new T.MeshStandardMaterial({color:[0x385754,0x885747,0x434f69,0x686349][index%4],roughness:.83});
  const stock = new T.MeshStandardMaterial({color:0xeee4cd,roughness:.94});
  const foil = new T.MeshStandardMaterial({color:0xcab38a,metalness:.28,roughness:.51});
  const block = (w,h,d,px,py,pz,mat,parent=root) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w,h,d), mat);
    mesh.position.set(px,py,pz); mesh.receiveShadow=true; parent.add(mesh);
    return mesh;
  };
  block(.689,.025,.904,.332,.013,0,cloth);
  block(.657,.046,.862,.334,.046,0,stock);
  block(.043,.072,.90,-.004,.041,0,cloth);
  coverPivot.position.y=.044; root.add(coverPivot);
  block(.69,.026,.904,.332,.041,0,cloth,coverPivot);
  for(const z of [-.333,.333]) block(.52,.002,.004,.336,.055,z,foil,coverPivot);
  // The section drawing belongs to the inside cover; its underside faces up when opened.
  const canvas=document.createElement('canvas'); canvas.width=384;canvas.height=512;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#dfd6bb';ctx.fillRect(0,0,384,512);
  ctx.strokeStyle='#82795f';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(38,386);ctx.lineTo(348,386);ctx.stroke();
  for(let n=0;n<3;n++){
    const cx=105+n*87, floor=367-n*21;
    ctx.beginPath();ctx.moveTo(cx-41,382);ctx.lineTo(cx-41,floor-90);
    ctx.arc(cx,floor-90,41,Math.PI,2*Math.PI);ctx.lineTo(cx+41,382);ctx.stroke();
    ctx.beginPath();ctx.arc(cx,floor-90,46,Math.PI,2*Math.PI);ctx.stroke();
  }
  ctx.fillStyle='#49483a';ctx.font='16px Georgia, serif';ctx.fillText('C A R N E T   /   '+String(index+1).padStart(2,'0'),33,54);
  ctx.font='22px serif';ctx.fillText('拱廊剖面',32,101);
  ctx.font='italic 14px Georgia, serif';ctx.fillText('Étude de passage',33,430);
  const ink=new T.CanvasTexture(canvas); ink.colorSpace=T.SRGBColorSpace;
  const illustrated=new T.MeshBasicMaterial({map:ink,side:T.DoubleSide});
  for(let i=0;i<4;i++){
    const pivot=new T.Group();pivot.position.y=.078-i*.0015;root.add(pivot);leaves.push(pivot);
    block(.653,.002,.851,.335,0,0,stock,pivot);
    if(i===3){
      const plate=new T.Mesh(new T.PlaneGeometry(.625,.82),illustrated);
      plate.position.set(.332,-.0013,0);plate.rotation.set(-Math.PI/2,Math.PI,0);pivot.add(plate);
    }
  }
  function pose(p) {
    const values=bookPose(p);root.position.y=y+values.lift;
    coverPivot.rotation.z=values.cover;leaves.forEach((leaf,i)=>{leaf.rotation.z=values.leaves[i];});
    return values;
  }
  return {root,pose,baseY:y,coverPivot};
}

// The player body never moves into a desk. Only the eye travels, from its
// actual orientation (including a mid-glide reversal), via shortest-arc slerp.
export function createPresentation(T, camera, reduced) {
  let mode='', book=null, openness=0, t=0, moving=false, onDone=null, length=.45;
  const from=new T.Vector3(),dest=new T.Vector3(),returnEye=new T.Vector3();
  const fromQ=new T.Quaternion(), destQ=new T.Quaternion(), returnQ=new T.Quaternion();
  let bookFrom=0, bookTo=0, crossing=null, veil=null, covered=false;
  function to(position,quaternion,duration,finish) {
    from.copy(camera.position);fromQ.copy(camera.quaternion);dest.copy(position);destQ.copy(quaternion);
    t=0;length=duration;moving=true;onDone=finish;bookFrom=openness;
  }
  function focus(kind,position,lookAt,rig=null) {
    if(!mode){returnEye.copy(camera.position);returnQ.copy(camera.quaternion);}
    if(book && book!==rig)book.pose(0);
    if(book!==rig)openness=0;
    book=rig;bookTo=rig?1:0;mode=kind;
    const orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(position,lookAt,camera.up));
    to(position,orientation,rig ? .64 : .45,null);
  }
  function close(finish) {
    if(!mode || mode==='return')return false;
    mode='return';bookTo=0;
    to(returnEye,returnQ,book ? .58 : .45,()=>{mode='';book=null;finish?.();});
    return true;
  }
  function tick(dt) {
    if(mode==='portal'){
      t=Math.min(.42,t+(reduced() ? .42 : dt));
      if(t>=.21 && crossing && !covered){
        t=.21;covered=true;camera.position.copy(dest);veil(1);return;
      }
      if(t>=.21 && crossing){
        mode='';const arrive=crossing;crossing=null;arrive();
        mode='portal';dest.copy(camera.position);
        from.copy(dest).addScaledVector(camera.getWorldDirection(new T.Vector3()),-.29);
      }
      const p=crossing?t/.21:(t-.21)/.21,k=p*p*(3-2*p);
      camera.position.lerpVectors(from,dest,k);veil(crossing?k:1-k);
      if(t>=.42){mode='';moving=false;veil=null;}
      return;
    }
    if(!moving)return;
    t=Math.min(length,t+(reduced()?length:dt));
    const p=Math.min(1,t/Math.min(.45,length));
    const k=p<.5?4*p*p*p:1-((-2*p+2)**3)/2;
    camera.position.lerpVectors(from,dest,k);camera.quaternion.slerpQuaternions(fromQ,destQ,k);
    openness=bookFrom+(bookTo-bookFrom)*t/length;book?.pose(openness);
    if(t>=length){moving=false;const done=onDone;onDone=null;done?.();}
  }
  function travel(arrive,shade) {
    if(mode==='portal')return;
    mode='portal';moving=true;t=0;crossing=arrive;veil=shade;covered=false;
    from.copy(camera.position);dest.copy(from).addScaledVector(camera.getWorldDirection(new T.Vector3()),.46);
  }
  return {focus,close,tick,travel,get active(){return !!mode;},get mode(){return mode;},
    get book(){return book;},get amount(){return openness;},get moving(){return moving;}};
}
