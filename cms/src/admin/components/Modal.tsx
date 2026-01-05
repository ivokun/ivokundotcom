import { type ParentComponent, Show, onMount, onCleanup, createEffect } from 'solid-js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: import('solid-js').JSX.Element;
  footer?: import('solid-js').JSX.Element;
}

const Modal: ParentComponent<ModalProps> = (props) => {
  // Handle Escape key to close modal
  createEffect(() => {
    if (!props.isOpen) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose();
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    onCleanup(() => document.removeEventListener('keydown', handleEsc));
  });
  
  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          {/* Backdrop */}
          <div
            class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={props.onClose}
            aria-hidden="true"
          />
          
          {/* Modal panel */}
          <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <Show when={props.title}>
              <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold leading-6 text-gray-900">
                  {props.title}
                </h3>
              </div>
            </Show>
            
            <div class="px-4 py-3 sm:p-6">
              {props.children}
            </div>
            
            <Show when={props.footer}>
              <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-gray-200">
                {props.footer}
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default Modal;
