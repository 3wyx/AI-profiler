import React from 'react';
import styles from './Modal.module.css';

const Modal = ({ isOpen, onClose, text }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          <p className={styles.text}>{text}</p>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>Ладно</button>
      </div>
    </div>
  );
};

export default Modal;