/**
 * Unified Form Dialog Component
 * 
 * A generic form dialog component that adapts to different entity types
 * and generates forms dynamically based on entity schema configuration.
 * 
 * @fileoverview Unified form dialog implementation
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { BaseEntity } from '../types/core';
import { 
  FormFieldConfig, 
  FormMode, 
  FormDialogProps, 
  FormValidationResult 
} from '../types/form';

/**
 * Props for the unified form dialog component.
 */
export interface UnifiedFormDialogProps<T extends BaseEntity> extends FormDialogProps<T> {
  /** Form field configurations */
  fields: FormFieldConfig[];
  /** Form validation function */
  validate?: (data: Partial<T>) => FormValidationResult;
  /** Form submission handler */
  onSubmit: (data: Partial<T>) => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Unified Form Dialog Component
 * 
 * Renders a dynamic form dialog based on field configurations.
 * Supports create and edit modes with consistent validation.
 */
export function UnifiedFormDialog<T extends BaseEntity>({
  open,
  onOpenChange,
  mode,
  entity,
  fields,
  validate,
  onSubmit,
  isLoading = false,
  title
}: UnifiedFormDialogProps<T>) {
  const [formData, setFormData] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when entity changes
  useEffect(() => {
    if (mode === 'edit' && entity) {
      setFormData(entity);
    } else {
      setFormData({});
    }
    setErrors({});
  }, [entity, mode, open]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear field error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (validate) {
      const validation = validate(formData);
      if (!validation.isValid) {
        setErrors(validation.fieldErrors || {});
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormFieldConfig) => {
    const value = formData[field.name as keyof T];
    const hasError = !!errors[field.name];
    const errorMessage = errors[field.name];

    const commonProps = {
      id: field.name,
      disabled: isSubmitting || isLoading,
      required: field.required
    };

    let fieldElement;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        fieldElement = (
          <Input
            {...commonProps}
            type={field.type}
            value={String(value || '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={hasError ? 'border-destructive' : ''}
          />
        );
        break;

      case 'textarea':
        fieldElement = (
          <Textarea
            {...commonProps}
            value={String(value || '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={hasError ? 'border-destructive' : ''}
            rows={3}
          />
        );
        break;

      case 'select':
        fieldElement = (
          <Select
            value={String(value || '')}
            onValueChange={(newValue) => handleFieldChange(field.name, newValue)}
            disabled={commonProps.disabled}
          >
            <SelectTrigger className={hasError ? 'border-destructive' : ''}>
              <SelectValue placeholder={field.placeholder || 'Selecione...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem 
                  key={typeof option === 'string' ? option : option.value} 
                  value={String(typeof option === 'string' ? option : option.value)}
                >
                  {typeof option === 'string' ? option : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        break;

      case 'boolean':
        fieldElement = (
          <Switch
            {...commonProps}
            checked={Boolean(value)}
            onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
          />
        );
        break;

      default:
        fieldElement = (
          <Input
            {...commonProps}
            value={String(value || '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={hasError ? 'border-destructive' : ''}
          />
        );
    }

    return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name} className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {fieldElement}
        {hasError && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {title || (mode === 'create' ? 'Criar' : 'Editar')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            {fields.map(renderField)}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UnifiedFormDialog;