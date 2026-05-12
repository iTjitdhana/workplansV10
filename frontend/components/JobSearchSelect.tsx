import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Select, { SingleValue, ActionMeta, InputActionMeta } from 'react-select';
import { debugLog, debugError, getApiUrl } from '@/lib/config';

export interface JobOption {
  value: string;
  label: string;
  job_code: string;
  job_name: string;
}

interface JobSearchSelectProps {
  value: string;
  onChange: (jobCode: string, jobName: string) => void;
  onAddNew?: (jobName: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  className?: string;
  allowAddNew?: boolean;
}

export const JobSearchSelect: React.FC<JobSearchSelectProps> = ({
  value,
  onChange,
  onAddNew,
  placeholder = "ค้นหางาน...",
  isDisabled = false,
  isInvalid = false,
  className = "",
  allowAddNew = true
}) => {
  const [options, setOptions] = useState<JobOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const shouldClearOnBlurRef = useRef(false);
  
  // แก้ไข hydration error
  useEffect(() => {
    setIsClient(true);
  }, []);

  // สร้าง selected value
  const selectedValue = useMemo(() => {
    if (!value) return null;
    const matchedOption = options.find(opt => opt.job_name === value);

    // ไม่ใช้ temporary "add-new-*" label เป็น selected value
    // เพื่อให้การแสดงผลคงที่หลังผู้ใช้เลือกเพิ่มงานใหม่
    if (matchedOption && !(matchedOption.job_code === 'NEW' && matchedOption.value.startsWith('add-new-'))) {
      return matchedOption;
    }

    return {
      value: value,
      label: value,
      job_code: '',
      job_name: value
    };
  }, [value, options]);

  // ค้นหาข้อมูล
  const loadOptions = useCallback(async (inputValue: string) => {
    if (!inputValue || inputValue.trim().length < 2) {
      setOptions([]);
      return;
    }

    try {
      setIsLoading(true);
      debugLog('🔍 Searching for:', inputValue.trim());
      
      const response = await fetch(getApiUrl(`/api/process-steps/search?query=${encodeURIComponent(inputValue.trim())}`));
      const data = await response.json();
      
      if (data.success && data.data) {
        const formattedOptions: JobOption[] = data.data.map((item: any) => ({
          value: item.job_name.trim(),
          label: `${item.job_code.trim()} - ${item.job_name.trim()}`,
          job_code: item.job_code.trim(),
          job_name: item.job_name.trim()
        }));
        
        // เพิ่มตัวเลือก "เพิ่มงานใหม่" ถ้า allowAddNew = true และไม่พบผลลัพธ์
        if (allowAddNew && formattedOptions.length === 0 && inputValue.trim().length >= 2) {
          formattedOptions.push({
            value: `add-new-${inputValue.trim()}`,
            label: `➕ เพิ่มงานใหม่: "${inputValue.trim()}"`,
            job_code: 'NEW',
            job_name: inputValue.trim()
          });
        }
        
        setOptions(formattedOptions);
        debugLog('✅ Found options:', formattedOptions.length);
      } else {
        // ไม่พบข้อมูล แต่ถ้า allowAddNew = true ให้เพิ่มตัวเลือก "เพิ่มงานใหม่"
        if (allowAddNew && inputValue.trim().length >= 2) {
          const addNewOption: JobOption = {
            value: `add-new-${inputValue.trim()}`,
            label: `➕ เพิ่มงานใหม่: "${inputValue.trim()}"`,
            job_code: 'NEW',
            job_name: inputValue.trim()
          };
          setOptions([addNewOption]);
          debugLog('➕ Showing add new option for:', inputValue.trim());
        } else {
          setOptions([]);
          debugLog('❌ No results found');
        }
      }
    } catch (error) {
      debugError('Error searching:', error);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [allowAddNew]);

  // จัดการการเลือก
  const handleChange = useCallback((
    newValue: SingleValue<JobOption>,
    actionMeta: ActionMeta<JobOption>
  ) => {
    debugLog('🎯 Selected value:', newValue);
    debugLog('🎯 Action:', actionMeta.action);
    
    if (newValue) {
      // หลังเลือก option ให้กลับไปโหมดแสดงค่า selected ทันที
      setIsEditing(false);
      setSearchInput('');
      shouldClearOnBlurRef.current = false;

      // ตรวจสอบว่าเป็นการเพิ่มงานใหม่หรือไม่
      if (newValue.job_code === 'NEW' && newValue.value.startsWith('add-new-')) {
        debugLog('➕ Adding new job:', newValue.job_name);
        if (onAddNew) {
          onAddNew(newValue.job_name);
        } else {
          // ถ้าไม่มี onAddNew callback ให้ใช้ onChange ปกติ
          onChange('NEW', newValue.job_name);
        }
      } else {
        // งานที่มีอยู่แล้วในระบบ
        onChange(newValue.job_code, newValue.job_name);
      }
    } else {
      setIsEditing(false);
      setSearchInput('');
      shouldClearOnBlurRef.current = false;
      onChange('', '');
    }
  }, [onChange, onAddNew]);

  // จัดการการพิมพ์
  const handleInputChange = useCallback((newValue: string, actionMeta: InputActionMeta) => {
    debugLog('📝 Input change:', newValue, actionMeta.action);

    // ค้นหาเฉพาะตอนผู้ใช้พิมพ์จริงเท่านั้น
    if (actionMeta.action === 'input-change') {
      setSearchInput(newValue);
      shouldClearOnBlurRef.current = newValue.trim().length === 0;
      loadOptions(newValue);
    }
  }, [loadOptions]);

  // เมื่อโฟกัส ให้เอาค่าเดิมมาให้แก้ไขต่อได้ทันที
  const handleFocus = useCallback(() => {
    setIsEditing(true);
    setSearchInput(value || '');
    shouldClearOnBlurRef.current = false;
  }, [value]);

  // เมื่อ blur ให้กลับไปโหมดแสดง selected value
  const handleBlur = useCallback(() => {
    if (shouldClearOnBlurRef.current && value) {
      onChange('', '');
    }
    shouldClearOnBlurRef.current = false;
    setIsEditing(false);
    setSearchInput('');
  }, [onChange, value]);

  // บางกรณี react-select โฟกัสค้าง ทำให้ onFocus ไม่ยิงซ้ำ
  // ใช้ onMenuOpen บังคับเข้าโหมดแก้ไขเมื่อผู้ใช้คลิกช่องอีกครั้ง
  const handleMenuOpen = useCallback(() => {
    setIsEditing(true);
    setSearchInput(value || '');
    shouldClearOnBlurRef.current = false;
  }, [value]);

  // Custom styles
  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      minHeight: '38px',
      border: `1px solid ${isInvalid ? '#ef4444' : '#d1d5db'}`,
      borderRadius: '6px',
      '&:hover': {
        border: `1px solid ${isInvalid ? '#dc2626' : '#10b981'}`
      },
      boxShadow: state.isFocused
        ? (isInvalid ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : '0 0 0 2px rgba(16, 185, 129, 0.1)')
        : 'none'
    }),
    option: (provided: any, state: any) => {
      const isAddNew = state.data?.job_code === 'NEW';
      return {
        ...provided,
        backgroundColor: state.isSelected 
          ? (isAddNew ? '#10b981' : '#10b981')
          : state.isFocused 
          ? (isAddNew ? '#d1fae5' : '#f3f4f6')
          : 'white',
        color: state.isSelected ? 'white' : (isAddNew ? '#059669' : '#374151'),
        fontWeight: isAddNew ? '600' : '400',
        '&:hover': {
          backgroundColor: state.isSelected 
            ? (isAddNew ? '#10b981' : '#10b981')
            : (isAddNew ? '#d1fae5' : '#f3f4f6'),
          color: state.isSelected ? 'white' : (isAddNew ? '#059669' : '#374151')
        }
      };
    },
    menu: (provided: any) => ({
      ...provided,
      zIndex: 9999
    })
  };

  // แก้ไข hydration error - รอให้ client render เสร็จก่อน
  if (!isClient) {
    return (
      <div className={className}>
        <div className="border rounded px-3 py-2 bg-gray-50 text-gray-500">
          กำลังโหลด...
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select
        value={selectedValue}
        onChange={handleChange}
        onInputChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        options={options}
        isLoading={isLoading}
        isDisabled={isDisabled}
        isClearable
        isSearchable
        placeholder={placeholder}
        noOptionsMessage={({ inputValue }) => {
          if (inputValue.trim().length < 2) {
            return 'พิมพ์อย่างน้อย 2 ตัวอักษร';
          }
          return allowAddNew 
            ? `ไม่พบข้อมูล - พิมพ์เพื่อเพิ่มงานใหม่ "${inputValue.trim()}"` 
            : 'ไม่พบข้อมูล';
        }}
        loadingMessage={() => 'กำลังค้นหา...'}
        styles={customStyles}
        menuPosition="fixed"
        menuPlacement="auto"
        controlShouldRenderValue={!isEditing}
        onMenuOpen={handleMenuOpen}
        filterOption={() => true} // ปิด client-side filter
        inputValue={isEditing ? searchInput : undefined}
      />
    </div>
  );
};

export default JobSearchSelect;
