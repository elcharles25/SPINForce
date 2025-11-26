export const replaceTemplateVariables = (
  template: string,
  variables: Record<string, string>
): string => {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
};

export const getMonthName = (monthNumber: number): string => {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return months[monthNumber - 1] || '';
};

export const formatAttachments = (files: Array<{ name: string; url: string }>) => {
  return files.map(file => ({
    filename: file.name,
    content: file.url.startsWith('http') ? file.url : `http://localhost:3001${file.url}`
  }));
};