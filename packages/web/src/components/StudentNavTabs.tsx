import { NavLink } from 'react-router-dom';

export function StudentNavTabs({ id }: { id: string }) {
  const tabs = [
    { to: `/students/${id}`, label: 'Student File', end: true },
    { to: `/students/${id}/curriculum`, label: 'Curriculum' },
    { to: `/students/${id}/advise`, label: 'Advise Me' },
    { to: `/students/${id}/target-cgpa`, label: 'Target CGPA' },
    { to: `/students/${id}/quiz`, label: 'Best-Fit Quiz' },
    { to: `/students/${id}/probation-history`, label: 'Probation History' },
    { to: `/students/${id}/proposals`, label: 'Proposals' },
  ];
  return (
    <div className="nav-tabs">
      {tabs.map(t => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
