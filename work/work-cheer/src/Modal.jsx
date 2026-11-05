import React, { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
export function Modal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className={'modal ' + className} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} aria-label={title}>
    <div className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={22}/></button></div>
    {children}
  </dialog>;
}
