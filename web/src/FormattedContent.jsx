import React from 'react';

// The editor stores simple Markdown as text. We render React nodes,
// never HTML strings, so submitted text cannot execute scripts.
function inline(value) {
  return String(value).split(/(\*\*[^\n*]+\*\*)/g).map((part,i)=>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2,-2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>);
}

export default function FormattedContent({text=''}) {
  const lines=String(text).split(/\r?\n/);
  return <div className="formattedContent">{lines.map((line,i)=>{
    if(/^###\s/.test(line))return <h3 key={i}>{inline(line.slice(4))}</h3>;
    if(/^##\s/.test(line))return <h2 key={i}>{inline(line.slice(3))}</h2>;
    if(/^#\s/.test(line))return <h2 key={i}>{inline(line.slice(2))}</h2>;
    if(/^\s*[-*]\s+/.test(line))return <div className="mdListLine" key={i}><span>•</span><span>{inline(line.replace(/^\s*[-*]\s+/,''))}</span></div>;
    if(/^\s*\d+\.\s+/.test(line)){
      const match=line.match(/^\s*(\d+)\.\s+/);
      return <div className="mdListLine" key={i}><span>{match[1]}.</span><span>{inline(line.slice(match[0].length))}</span></div>;
    }
    return <p key={i}>{inline(line)||'\u00a0'}</p>;
  })}</div>;
}
