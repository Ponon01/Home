import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Building2, Home, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';

const COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

export default function DashboardAnalytics({ complexes = [] }) {
  const metrics = useMemo(() => {
    // Basic totals
    const totalComplexes = complexes.filter(c => c.residential_complex_name && c.residential_complex_name.trim().toLowerCase() !== 'unknown' && c.residential_complex_name.trim().toLowerCase() !== 'жк').length;
    let totalApartments = 0;
    let notForSale = 0;
    let forSale = 0;
    let totalSold = 0;

    // Years data
    const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    const yearlyDataMap = {};
    years.forEach(y => yearlyDataMap[y] = 0);

    // Top components data
    let complexData = [];

    complexes.forEach(c => {
      const name = c.residential_complex_name || 'Неизвестно';
      // skip problematic ones from charts if needed, or include them. We include them in calculations.

      const aptCount = Number(c.total_count) || 0;
      const soldCount = Number(c.sold_total) || 0;

      totalApartments += aptCount;
      notForSale += Number(c.not_for_sale_count) || 0;
      forSale += Number(c.for_sale_count) || 0;
      totalSold += soldCount;

      years.forEach(y => {
        yearlyDataMap[y] += Number(c[`sold_${y}`]) || 0;
      });

      if (name.toLowerCase() !== 'unknown' && name.toLowerCase() !== 'жк') {
        complexData.push({
          name,
          apartments: aptCount,
          sold: soldCount
        });
      }
    });

    const yearlyChartData = years.map(y => ({
      year: y,
      realized: yearlyDataMap[y]
    }));

    const topByApartments = [...complexData].sort((a, b) => b.apartments - a.apartments).slice(0, 10);
    const topBySold = [...complexData].sort((a, b) => b.sold - a.sold).slice(0, 10);

    const pieData = [
      { name: 'К реализации', value: forSale },
      { name: 'Не подлежат реализации', value: notForSale }
    ];

    return {
      totalComplexes,
      totalApartments,
      notForSale,
      forSale,
      totalSold,
      yearlyChartData,
      topByApartments,
      topBySold,
      pieData
    };
  }, [complexes]);

  if (!complexes || complexes.length === 0) {
    return null; // Or show empty state
  }

  return (
    <div className="dashboard-analytics">
      <div className="kpi-container">
        <div className="kpi-card" style={{ '--kpi-color': '#3b82f6', '--kpi-bg': '#eff6ff' }}>
          <div className="kpi-icon-wrapper"><Building2 size={24} /></div>
          <div className="kpi-content">
            <div className="kpi-title">Всего ЖК</div>
            <div className="kpi-value">{metrics.totalComplexes}</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#8b5cf6', '--kpi-bg': '#f5f3ff' }}>
          <div className="kpi-icon-wrapper"><Home size={24} /></div>
          <div className="kpi-content">
            <div className="kpi-title">Всего квартир</div>
            <div className="kpi-value">{metrics.totalApartments}</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#ef4444', '--kpi-bg': '#fef2f2' }}>
          <div className="kpi-icon-wrapper"><XCircle size={24} /></div>
          <div className="kpi-content">
            <div className="kpi-title">Не подлежат реализации</div>
            <div className="kpi-value">{metrics.notForSale}</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#f59e0b', '--kpi-bg': '#fffbeb' }}>
          <div className="kpi-icon-wrapper"><TrendingUp size={24} /></div>
          <div className="kpi-content">
            <div className="kpi-title">К реализации</div>
            <div className="kpi-value">{metrics.forSale}</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#10b981', '--kpi-bg': '#ecfdf5' }}>
          <div className="kpi-icon-wrapper"><CheckCircle2 size={24} /></div>
          <div className="kpi-content">
            <div className="kpi-title">Всего реализовано</div>
            <div className="kpi-value">{metrics.totalSold}</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        {/* Realization by Years (Line/Bar) */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <h3 className="chart-title"><TrendingUp size={20} color="#3498db" /> Динамика реализации по годам</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.yearlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '5px' }}
                />
                <Line type="monotone" dataKey="realized" name="Реализовано" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Status */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title"><CheckCircle2 size={20} color="#8b5cf6" /> Статус реализации (из всего пула)</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {metrics.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 500 }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Complexes by Apartments */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title"><Building2 size={20} color="#10b981" /> Топ-10 ЖК по количеству квартир</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topByApartments} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="apartments" name="Квартир" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Complexes by Realization */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <h3 className="chart-title"><TrendingUp size={20} color="#f59e0b" /> Топ ЖК по объему реализации</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topBySold} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, angle: -45, textAnchor: 'end' }} height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="sold" name="Реализовано" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
