import React,{useEffect,useRef,useState} from 'react';
import {usePreferences} from './preferences.jsx';
import TablerIcon from './TablerIcon.jsx';

const PREVIEW_SIZE=280;
const OUTPUT_SIZE=512;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

/** Drag, zoom, and precisely reposition a new avatar BEFORE sending it.
 *  Only the final square WebP crop is uploaded to the existing backend. */
export default function AvatarCropper({file,onSave,onCancel,busy=false}) {
  const {t}=usePreferences();
  const [image,setImage]=useState(null);
  const [zoom,setZoom]=useState(1);
  const [position,setPosition]=useState({x:0,y:0});
  const [error,setError]=useState('');
  const imageRef=useRef(null);
  const dragRef=useRef(null);
  useEffect(()=>{
    if(!file)return;
    const src=URL.createObjectURL(file);
    const probe=new Image();
    let alive=true;
    setZoom(1);setPosition({x:0,y:0});setError('');
    probe.onload=()=>{
      if(alive)setImage({src,width:probe.naturalWidth,height:probe.naturalHeight});
    };
    probe.onerror=()=>{if(alive)setError(t('Unable to preview this image.'));};
    probe.src=src;
    return()=>{alive=false;URL.revokeObjectURL(src);};
  },[file]);
  useEffect(()=>{
    function esc(event){if(event.key==='Escape'&&!busy)onCancel();}
    document.addEventListener('keydown',esc);
    return()=>document.removeEventListener('keydown',esc);
  },[busy,onCancel]);
  if(!file)return null;
  const fit=image?PREVIEW_SIZE/Math.min(image.width,image.height):1;
  const w=image?image.width*fit*zoom:PREVIEW_SIZE;
  const h=image?image.height*fit*zoom:PREVIEW_SIZE;
  const maxX=Math.max(0,(w-PREVIEW_SIZE)/2);
  const maxY=Math.max(0,(h-PREVIEW_SIZE)/2);
  const shiftX=position.x*maxX/100,shiftY=position.y*maxY/100;
  function start(event){
    if(!image||busy)return;
    dragRef.current={id:event.pointerId,x:event.clientX,y:event.clientY,initial:position};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event){
    const drag=dragRef.current;
    if(!drag||drag.id!==event.pointerId)return;
    setPosition({
      x:maxX>0?clamp(drag.initial.x+(event.clientX-drag.x)/maxX*100,-100,100):0,
      y:maxY>0?clamp(drag.initial.y+(event.clientY-drag.y)/maxY*100,-100,100):0,
    });
  }
  async function save(){
    if(!image||busy||!imageRef.current)return;
    setError('');
    try{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=OUTPUT_SIZE;
      const ctx=canvas.getContext('2d');
      if(!ctx)throw Error('Canvas unavailable');
      const scale=fit*zoom;
      const sourceSide=PREVIEW_SIZE/scale;
      const sourceX=clamp((image.width-sourceSide)/2-shiftX/scale,0,image.width-sourceSide);
      const sourceY=clamp((image.height-sourceSide)/2-shiftY/scale,0,image.height-sourceSide);
      ctx.drawImage(imageRef.current,sourceX,sourceY,sourceSide,sourceSide,0,0,OUTPUT_SIZE,OUTPUT_SIZE);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(
        output=>output?resolve(output):reject(Error('Could not crop image')),'image/webp',.9));
      await onSave(blob);
    }catch(err){setError(err.message||t('Unable to crop photo.'));}
  }
  return <div className="avatarCropOverlay" role="presentation" onPointerDown={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}>
    <div className="avatarCropDialog" role="dialog" aria-modal="true" aria-label={t('Adjust profile photo')}>
      <div className="avatarCropHeading">
        <h2>{t('Adjust profile photo')}</h2>
        <button type="button" disabled={busy} title={t('Cancel')} aria-label={t('Cancel')} onClick={onCancel}>
          <TablerIcon name="close" size={20}/></button>
      </div>
      <div className="avatarCropViewport" onPointerDown={start} onPointerMove={move}
        onPointerUp={()=>{dragRef.current=null;}} onPointerCancel={()=>{dragRef.current=null;}}
        aria-label={t('Drag to reposition photo')} title={t('Drag to reposition photo')}>
        {image&&<img ref={imageRef} src={image.src} alt="" draggable="false" style={{
          width:w,height:h,left:`calc(50% + ${shiftX}px)`,top:`calc(50% + ${shiftY}px)`
        }}/>}
        {!image&&!error&&<span className="avatarCropLoading">{t('Loading…')}</span>}
      </div>
      <div className="avatarCropControls">
        <label>{t('Zoom')}<input type="range" min="1" max="3" step=".02" value={zoom}
          aria-label={t('Zoom')} onChange={event=>setZoom(Number(event.target.value))}/></label>
        <label>{t('Move up / down')}<input type="range" min="-100" max="100" step="1"
          value={position.y} aria-label={t('Move up / down')} disabled={maxY===0}
          onChange={event=>setPosition(v=>({...v,y:Number(event.target.value)}))}/></label>
        <label>{t('Move left / right')}<input type="range" min="-100" max="100" step="1"
          value={position.x} aria-label={t('Move left / right')} disabled={maxX===0}
          onChange={event=>setPosition(v=>({...v,x:Number(event.target.value)}))}/></label>
      </div>
      {error&&<p role="alert" className="avatarCropError">{error}</p>}
      <div className="avatarCropActions">
        <button type="button" disabled={busy} onClick={onCancel}>{t('Cancel')}</button>
        <button type="button" className="primary" disabled={busy||!image} onClick={save}>
          <TablerIcon name="check" size={18}/>{t(busy?'Uploading photo…':'Save photo')}</button>
      </div>
    </div>
  </div>;
}
