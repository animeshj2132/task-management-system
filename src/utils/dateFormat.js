
export function parseDate (dateStr) {
    const dateParts = dateStr.split('/');
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Months are zero-based in JavaScript Date
    const year = parseInt(dateParts[2], 10);
    return new Date(Date.UTC(year, month, day)); // Set time to midnight UTC
  };
  
  export function formatDate (date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date object');
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${year}-${month}-${day}`;
  };
  