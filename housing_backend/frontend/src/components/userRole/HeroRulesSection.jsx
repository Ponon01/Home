import React, { useState } from 'react';
import { Download, ChevronRight, Users, ListOrdered, ShieldAlert, LogOut } from 'lucide-react';

const cardBaseStyle = {
  background: '#053526',
  border: '1px solid rgba(197, 160, 89, 0.4)',
  borderRadius: '16px',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '260px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
};

const cardHoverStyle = {
  ...cardBaseStyle,
  boxShadow: '0 12px 30px rgba(197, 160, 89, 0.25)',
  borderColor: '#C5A059',
  transform: 'translateY(-6px)',
};

function Card({ icon: Icon, title, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={hovered ? cardHoverStyle : cardBaseStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div>
        {/* Иконка в кружке */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'rgba(197,160,89,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <Icon size={20} color="#C5A059" />
        </div>

        {/* Заголовок */}
        <h3 style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px', marginBottom: '10px' }}>
          {title}
        </h3>

        {/* Линия-акцент */}
        <div style={{ width: '32px', height: '2px', background: 'rgba(197,160,89,0.6)', borderRadius: '2px', marginBottom: '14px' }} />

        {/* Контент */}
        {children}
      </div>

      {/* Стрелка */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <ChevronRight
          size={18}
          color="#C5A059"
          style={{ transition: 'transform 0.3s', transform: hovered ? 'translateX(4px)' : 'translateX(0)' }}
        />
      </div>
    </div>
  );
}

export default function HeroRulesSection() {
  return (
    <div className="hero-rules-shell">
      {/* ОСНОВНОЙ КОНТЕНТ — всё на inline styles */}
      <div style={{
        paddingTop: '60px',
        paddingBottom: '40px',
        paddingLeft: '32px',
        paddingRight: '32px',
        backgroundColor: '#032b1e',
      }}>

        {/* Hero: 2 колонки */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          maxWidth: '1280px',
          margin: '0 auto 48px auto',
          alignItems: 'center',
        }}>
          {/* Левая часть */}
          <div>
            <h1 style={{
              color: '#ffffff',
              fontSize: '42px',
              fontWeight: 'bold',
              fontFamily: 'serif',
              lineHeight: '1.2',
              margin: 0,
            }}>
              Официальные правила предоставления жилья
            </h1>

            {/* Золотая линия */}
            <div style={{
              width: '64px', height: '4px',
              background: 'linear-gradient(90deg, #d4af37, #f3e5ab)',
              borderRadius: '4px',
              margin: '16px 0',
            }} />

            <p style={{
              color: '#a0aec0',
              fontSize: '16px',
              lineHeight: '1.6',
              marginTop: '12px',
              marginBottom: '0',
            }}>
              На основании приказа № 02-05/452-ОД — основные условия и порядок получения служебного жилья.
            </p>

            {/* Кнопка */}
            <a
              href="/с ЭЦП.pdf"
              download="Приказ_02-05_452-ОД.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: 'linear-gradient(135deg, #C5A059 0%, #E2C78A 50%, #C5A059 100%)',
                color: '#032b1e',
                fontWeight: 'bold',
                padding: '14px 28px',
                borderRadius: '12px',
                marginTop: '24px',
                cursor: 'pointer',
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(197, 160, 89, 0.3)',
                fontSize: '15px',
              }}
            >
              <Download size={18} />
              <span>Скачать приказ (№ 02-05/452-ОД)</span>
            </a>
          </div>

          {/* Правая часть — пустая */}
          <div />
        </div>

        {/* 3 Карточки */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
          maxWidth: '1280px',
          margin: '0 auto',
        }}>

          <Card icon={Users} title="Кто имеет право">
            <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: '1.65', margin: 0 }}>
              Работники и члены его семьи, не имеющие жилья в г. Астане и в радиусе 50 км в течение последних 3 лет.
            </p>
          </Card>

          <Card icon={ListOrdered} title="Критерии очереди">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { num: '01', label: '1-я очередь', desc: '— специалисты особой творческой значимости.' },
                { num: '02', label: '2-я очередь', desc: '— остро нуждающиеся работники с вкладом.' },
                { num: '03', label: '3-я очередь', desc: '— сотрудники из журнала учёта без взысканий.' },
              ].map(({ num, label, desc }) => (
                <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{
                    background: 'rgba(197,160,89,0.15)',
                    color: '#C5A059',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    borderRadius: '50%',
                    width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{num}</span>
                  <span style={{ color: '#9ca3af', fontSize: '13px', lineHeight: '1.6' }}>
                    <strong style={{ color: '#d1d5db' }}>{label}</strong> {desc}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card icon={ShieldAlert} title="Важные условия">
            <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: '1.65', margin: 0 }}>
              Жильё предоставляется только на период трудовых отношений. При увольнении — выселение в течение 10 дней. Амортизация признаётся материальной выгодой с удержанием налогов.
            </p>
          </Card>

        </div>
      </div>
    </div>
  );
}