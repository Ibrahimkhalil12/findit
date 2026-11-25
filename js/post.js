/**
 * FindIt - Lost & Found Portal
 * Post Item Controller: Protected Route, Image Validation & Secure Submission
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Authors: Konika Tripura & MD Ibrahim Khalil
 */

(function (window) {
  'use strict';

  let selectedImageFile = null;
  let currentUser = null;

  // --------------------------------------------------------------------------
  // 1. Authentication Check & Setup
  // --------------------------------------------------------------------------
  async function initPostPage() {
    currentUser = await window.FindItAuth.requireAuth();
    if (!currentUser) return; // Will redirect

    initTypeToggles();
    initImageUpload();
    initFormSubmission();
    setDefaultDate();
    await prefillContactDetails();
  }

  async function prefillContactDetails() {
    const phoneInput = document.getElementById('contact-phone');
    const emailInput = document.getElementById('contact-email');
    if (!phoneInput && !emailInput) return;

    const profile = window.FindItDB ? await window.FindItDB.getProfile() : null;
    if (phoneInput && !phoneInput.value) {
      phoneInput.value = (profile && profile.phone) || currentUser?.user_metadata?.phone || '';
    }
    if (emailInput && !emailInput.value) {
      emailInput.value = (profile && profile.email) || currentUser?.email || '';
    }
  }

  function setDefaultDate() {
    const dateInput = document.getElementById('item-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  // --------------------------------------------------------------------------
  // 2. Type Selector & Verification Fields Toggle
  // --------------------------------------------------------------------------
  function initTypeToggles() {
    const typeInputs = document.querySelectorAll('input[name="item_type"]');
    const verifySection = document.getElementById('found-verification-section');
    const verifyQuestionInput = document.getElementById('verify-question');
    const verifyAnswerInput = document.getElementById('verify-answer');
    const contactHint = document.getElementById('contact-privacy-hint');

    function applyTypeUI(selectedType) {
      if (selectedType === 'found') {
        if (verifySection) verifySection.style.display = 'block';
        if (verifyQuestionInput) verifyQuestionInput.required = true;
        if (verifyAnswerInput) verifyAnswerInput.required = true;
        if (contactHint) {
          contactHint.innerHTML = 'For <strong>Found Items</strong>, your phone number and email remain strictly <strong>hidden</strong> until the true owner answers your secret verification question correctly.';
        }
      } else {
        if (verifySection) verifySection.style.display = 'none';
        if (verifyQuestionInput) verifyQuestionInput.required = false;
        if (verifyAnswerInput) verifyAnswerInput.required = false;
        if (contactHint) {
          contactHint.innerHTML = 'For <strong>Lost Items</strong>, your phone number and email are shown normally on the listing so anyone who finds your belonging can contact you directly.';
        }
      }
    }

    typeInputs.forEach(input => {
      input.addEventListener('change', () => {
        const checked = document.querySelector('input[name="item_type"]:checked');
        if (checked) applyTypeUI(checked.value);
      });
    });

    // Honor URL query parameter (?type=found or ?type=lost)
    const params = new URLSearchParams(window.location.search);
    const urlType = (params.get('type') || '').toLowerCase();
    if (urlType === 'found' || urlType === 'lost') {
      const targetRadio = document.querySelector(`input[name="item_type"][value="${urlType}"]`);
      if (targetRadio) targetRadio.checked = true;
    }

    const initialChecked = document.querySelector('input[name="item_type"]:checked');
    applyTypeUI(initialChecked ? initialChecked.value : 'lost');
  }

  // --------------------------------------------------------------------------
  // 3. Image Upload Handling (Client-side Validation & Preview)
  // --------------------------------------------------------------------------
  function initImageUpload() {
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('image-input');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview-img');
    const removeBtn = document.getElementById('btn-remove-image');
    const errorAlert = document.getElementById('image-error-alert');

    if (!dropzone || !fileInput) return;

    // Trigger file dialog on dropzone click
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelection(fileInput.files[0]);
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSelectedImage();
      });
    }

    function handleFileSelection(file) {
      const maxSize = (window.CONFIG && window.CONFIG.MAX_IMAGE_SIZE_BYTES) || 2 * 1024 * 1024;
      const allowedTypes = (window.CONFIG && window.CONFIG.ALLOWED_IMAGE_TYPES) || ['image/jpeg', 'image/png', 'image/webp'];

      if (!allowedTypes.includes(file.type)) {
        showError(errorAlert, 'Invalid file format. Only JPEG, PNG, WEBP and GIF images are permitted.');
        return;
      }

      if (file.size > maxSize) {
        showError(errorAlert, `Image size exceeds the 2 MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller photo.`);
        return;
      }

      hideError(errorAlert);
      selectedImageFile = file;

      // Render preview
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        dropzone.style.display = 'none';
        previewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }

    function clearSelectedImage() {
      selectedImageFile = null;
      fileInput.value = '';
      previewImg.src = '';
      previewContainer.style.display = 'none';
      dropzone.style.display = 'block';
      hideError(errorAlert);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Form Submission
  // --------------------------------------------------------------------------
  function initFormSubmission() {
    const form = document.getElementById('post-item-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const formErrorAlert = document.getElementById('form-error-alert');

      const title = form.title.value.trim();
      const type = document.querySelector('input[name="item_type"]:checked').value;
      const category = form.category.value;
      const description = form.description.value.trim();
      const location = form.location.value.trim();
      const itemDate = form.item_date.value;
      const contactPhoneInput = document.getElementById('contact-phone');
      const contactEmailInput = document.getElementById('contact-email');
      const contactPhone = contactPhoneInput ? contactPhoneInput.value.trim() : '';
      const contactEmail = contactEmailInput ? contactEmailInput.value.trim() : '';

      if (contactPhone && contactPhone.length < 7) {
        showError(formErrorAlert, 'Please enter a valid contact phone number (at least 7 characters) or leave it blank.');
        return;
      }

      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        showError(formErrorAlert, 'Please enter a valid contact email address.');
        return;
      }

      let verifyQuestion = null;
      let verifyAnswer = null;

      if (type === 'found') {
        const qInput = document.getElementById('verify-question');
        const aInput = document.getElementById('verify-answer');
        verifyQuestion = qInput ? qInput.value.trim() : null;
        verifyAnswer = aInput ? aInput.value.trim() : null;

        if (!verifyQuestion || !verifyAnswer) {
          showError(formErrorAlert, 'For found items, a secret verification question and answer are required to ensure safe ownership verification.');
          return;
        }
      }

      setLoading(submitBtn, true, 'Submitting Report...');
      hideError(formErrorAlert);

      try {
        let imageUrl = null;

        // 1. Upload image to Supabase Storage if user selected an image
        if (selectedImageFile && window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
          const client = window.FindItDB.client;
          const bucketName = (window.CONFIG && window.CONFIG.STORAGE_BUCKET_NAME) || 'item-images';
          const fileExt = selectedImageFile.name.split('.').pop();
          const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const filePath = `${currentUser.id}/${safeName}`;

          const { error: uploadError } = await client.storage
            .from(bucketName)
            .upload(filePath, selectedImageFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('[Storage Upload Error]', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }

          const { data: publicUrlData } = client.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          imageUrl = publicUrlData ? publicUrlData.publicUrl : null;
        }

        // 2. Submit record via Secure RPC post_item (hashes secret answer inside database)
        let newItemId = null;

        if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
          const client = window.FindItDB.client;
          const { data, error } = await client.rpc('post_item', {
            p_title: title,
            p_type: type,
            p_category: category,
            p_description: description,
            p_location: location,
            p_item_date: itemDate,
            p_image_url: imageUrl,
            p_verify_question: verifyQuestion,
            p_verify_answer: verifyAnswer,
            p_contact_phone: contactPhone || null,
            p_contact_email: contactEmail || null
          });

          if (error) throw error;
          newItemId = data;
        } else {
          // Demo fallback ID
          newItemId = 'demo-' + Date.now();
        }

        window.FindIt.showToast('Item posted successfully!', 'success');

        setTimeout(() => {
          window.location.href = `item.html?id=${encodeURIComponent(newItemId)}`;
        }, 800);

      } catch (err) {
        console.error('[FindIt Post Error]', err);
        showError(formErrorAlert, err.message || 'An error occurred while publishing the report.');
        window.FindIt.showToast(err.message || 'Failed to submit report', 'error');
      } finally {
        setLoading(submitBtn, false, 'Publish Report');
      }
    });
  }

  function setLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = text;
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError(el) {
    if (!el) return;
    el.style.display = 'none';
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initPostPage();
  });

})(window);
