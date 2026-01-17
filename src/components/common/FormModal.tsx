/**
 * FormModal Component
 * 
 * A generic form modal component that renders forms dynamically based on configuration.
 * Supports multiple field types, validation, conditional visibility, and form state management.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12
 */

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, LucideIcon } from 'lucide-react';

/**
 * Supported field types for the FormModal
 * Requirement 4.5
 */
export type FieldType = 'text' | 'email' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'switch';

/**
 * Option type for select fields
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Configuration for a single form field
 * Requirements: 4.4, 4.5, 4.11, 4.12
 */
export interface FormField {
  /** Unique identifier for the field */
  name: string;
  /** Display label for the field */
  label: string;
  /** Type of input to render */
  type: FieldType;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the field is required (Requirement 4.9) */
  required?: boolean;
  /** Options for select fields */
  options?: SelectOption[];
  /** Number of rows for textarea fields */
  rows?: number;
  /** Minimum value for number/date/time fields */
  min?: number | string;
  /** Maximum value for number/date/time fields */
  max?: number | string;
  /** Step value for number fields */
  step?: number | string;
  /** Default value for the field */
  defaultValue?: any;
  /** Function to determine if field should be visible (Requirement 4.11) */
  visibleWhen?: (values: Record<string, any>) => boolean;
  /** Custom validation function (Requirement 4.12) */
  validate?: (value: any, values: Record<string, any>) => string | undefined;
}

/**
 * Props for the FormModal component
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8
 */
export interface FormModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title (Requirement 4.1) */
  title: string;
  /** Modal description (Requirement 4.2) */
  description?: string;
  /** Icon to display in header (Requirement 4.3) */
  icon?: LucideIcon;
  /** Array of field configurations (Requirement 4.4) */
  fields: FormField[];
  /** Initial values for form fields */
  initialValues?: Record<string, any>;
  /** Callback when form is submitted (Requirement 4.6) */
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  /** Loading state for submit button (Requirement 4.7) */
  isLoading?: boolean;
  /** Custom submit button label (Requirement 4.8) */
  submitLabel?: string;
  /** Custom cancel button label */
  cancelLabel?: string;
}

/**
 * Generic form modal component for creating consistent modal forms
 * 
 * @example
 * ```tsx
 * <FormModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Create Customer"
 *   description="Add a new customer to your business"
 *   icon={UserPlus}
 *   fields={[
 *     { name: 'name', label: 'Name', type: 'text', required: true },
 *     { name: 'email', label: 'Email', type: 'email' },
 *   ]}
 *   onSubmit={handleSubmit}
 *   isLoading={isCreating}
 *   submitLabel="Create"
 * />
 * ```
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  fields,
  initialValues = {},
  onSubmit,
  isLoading,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
}: FormModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Initialize form values when modal opens
   * Reset form state when modal closes (Requirement 4.10)
   */
  useEffect(() => {
    if (open) {
      const initial: Record<string, any> = {};
      fields.forEach((field) => {
        initial[field.name] = initialValues[field.name] ?? field.defaultValue ?? '';
      });
      setValues(initial);
      setErrors({});
    }
  }, [open, fields, initialValues]);

  /**
   * Handle field value changes
   * Clears error when field is modified
   */
  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear error when field changes
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Validate all form fields
   * Requirements: 4.9, 4.12
   * @returns true if form is valid, false otherwise
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach((field) => {
      // Skip validation for hidden fields (Requirement 4.11)
      if (field.visibleWhen && !field.visibleWhen(values)) return;
      
      const value = values[field.name];
      
      // Required validation (Requirement 4.9)
      if (field.required) {
        const isEmpty = value === '' || value === null || value === undefined;
        const isWhitespaceOnly = typeof value === 'string' && value.trim() === '';
        
        if (isEmpty || isWhitespaceOnly) {
          newErrors[field.name] = 'Campo obrigatório';
          return;
        }
      }
      
      // Custom validation (Requirement 4.12)
      if (field.validate) {
        const error = field.validate(value, values);
        if (error) {
          newErrors[field.name] = error;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   * Validates form before calling onSubmit (Requirement 4.9)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(values);
  };

  /**
   * Render a single form field based on its type
   * Requirement 4.5
   */
  const renderField = (field: FormField) => {
    // Check visibility condition (Requirement 4.11)
    if (field.visibleWhen && !field.visibleWhen(values)) {
      return null;
    }

    const value = values[field.name] ?? '';
    const error = errors[field.name];

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && ' *'}
            </Label>
            <Textarea
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows || 3}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && ' *'}
            </Label>
            <Select value={value} onValueChange={(v) => handleChange(field.name, v)}>
              <SelectTrigger id={field.name}>
                <SelectValue placeholder={field.placeholder || 'Selecione...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'switch':
        return (
          <div key={field.name} className="flex items-center justify-between">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Switch
              id={field.name}
              checked={!!value}
              onCheckedChange={(checked) => handleChange(field.name, checked)}
            />
          </div>
        );

      default:
        // Handles: text, email, number, date, time
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && ' *'}
            </Label>
            <Input
              id={field.name}
              type={field.type}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              step={field.step}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(renderField)}

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
