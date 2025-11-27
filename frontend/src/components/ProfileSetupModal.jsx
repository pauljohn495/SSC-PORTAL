import React, { useEffect, useMemo, useState } from 'react';
import { colleges } from '../data/colleges';

const ProfileSetupModal = ({
  isOpen,
  onSubmit,
  onCancel,
  isSaving,
  errorMessage
}) => {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedDepartment('');
      setSelectedCourse('');
    }
  }, [isOpen]);

  const courseOptions = useMemo(() => {
    const department = colleges.find(college => college.name === selectedDepartment);
    return department ? department.programs : [];
  }, [selectedDepartment]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedDepartment || !selectedCourse) {
      return;
    }
    onSubmit({
      department: selectedDepartment,
      course: selectedCourse
    });
  };

  return (
    <div className={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-3xl bg-blue-900">
        <h3 className="font-bold text-2xl text-white mb-4">Complete Your Profile</h3>
        <p className="text-white mb-6">
          Select your College and course so we can tailor announcements and updates for you.
        </p>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              College
            </label>
            <select
              className="select select-bordered w-full text-white"
              value={selectedDepartment}
              onChange={(event) => {
                setSelectedDepartment(event.target.value);
                setSelectedCourse('');
              }}
              required
            >
              <option value="" disabled>Select your College</option>
              {colleges.map((college) => (
                <option key={college.name} value={college.name}>
                  {college.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Course
            </label>
            <select
              className="select select-bordered w-full text-white"
              value={selectedCourse}
              onChange={(event) => setSelectedCourse(event.target.value)}
              disabled={!selectedDepartment}
              required
            >
              <option value="" disabled>
                {selectedDepartment ? 'Select your course' : 'Select a college first'}
              </option>
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-red-100 border border-red-200 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="modal-action">
            {onCancel && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedDepartment || !selectedCourse || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop bg-white pointer-events-none"></div>
    </div>
  );
};

export default ProfileSetupModal;

