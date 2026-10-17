import React, {useEffect, useState} from 'react';
import {assetUrl} from './api.js';

/** Shared gallery ensures editor previews look exactly like published post photos. */
export default function PostPhotoGallery({images=[],local=false}) {
  const [opened,setOpened]=useState(null);
  const [localUrls,setLocalUrls]=useState([]);
  useEffect(()=>{
    if(!local) return;
    const urls=images.map(item=>item?.file ? URL.createObjectURL(item.file) : null);
    setLocalUrls(urls);
    return ()=>urls.forEach(url=>url && URL.revokeObjectURL(url));
  },[images,local]);
  useEffect(()=>{
    if(!opened)return;
    function onKey(event){if(event.key==='Escape')setOpened(null);}
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[opened]);
  if(!images.length)return null;
  return <>
    <div className="postPhotoGallery">
      {images.map((image,index)=>{
        const url=(local && image.file?localUrls[index]:null) || assetUrl(image.url);
        return <button type="button" key={image.id??index}
          aria-label={`View photo ${index+1} full size`}
          onClick={()=>url&&setOpened(url)} disabled={!url}>
          {url&&<img src={url} alt={`Post photo ${index+1}`} loading="lazy"/>}
        </button>;
      })}
    </div>
    {opened&&<div className="photoLightbox" role="dialog" aria-modal="true"
      aria-label="Full-size post photo" onClick={()=>setOpened(null)}>
      <button type="button" aria-label="Close photo" onClick={()=>setOpened(null)}>×</button>
      <img alt="Full-size post photo" src={opened} onClick={event=>event.stopPropagation()}/>
    </div>}
  </>;
}
