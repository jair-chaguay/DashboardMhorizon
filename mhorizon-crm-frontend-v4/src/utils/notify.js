import Swal from 'sweetalert2';

const BRAND_COLOR = '#D4681C';

export const notifySuccess = (text, title = '¡Éxito!') => Swal.fire({
  title, text, icon: 'success', confirmButtonText: 'Entendido', confirmButtonColor: '#28a745',
});

export const notifyError = (text, title = 'Error') => Swal.fire({
  title, text, icon: 'error', confirmButtonText: 'Entendido', confirmButtonColor: BRAND_COLOR,
});

export async function confirmAction({ title, text, confirmText = 'Sí, continuar', danger = false }) {
  const result = await Swal.fire({
    title, text, icon: danger ? 'warning' : 'question', showCancelButton: true,
    confirmButtonText: confirmText, cancelButtonText: 'Cancelar',
    confirmButtonColor: danger ? '#dc2626' : BRAND_COLOR, reverseButtons: true,
  });
  return result.isConfirmed;
}

// Pide un texto corto (por ejemplo, el nombre de una plantilla). Devuelve null si cancela
export async function promptText({ title, text, placeholder = '', confirmText = 'Guardar', initialValue = '', allowEmpty = false }) {
  const result = await Swal.fire({
    title, text, input: 'text', inputValue: initialValue, inputPlaceholder: placeholder, showCancelButton: true,
    confirmButtonText: confirmText, cancelButtonText: 'Cancelar', confirmButtonColor: BRAND_COLOR, reverseButtons: true,
    inputValidator: (value) => (allowEmpty || value.trim() ? null : 'Escribe un nombre'),
  });
  return result.isConfirmed ? result.value.trim() : null;
}
