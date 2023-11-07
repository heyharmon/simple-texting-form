(function stJoinWebForm(
    win, 
    doc, 
    webFormId, 
    formFields,
    DUPLICATE_EMAIL_EXCEPTION, 
    DUPLICATE_PHONE_EXCEPTION, 
    CUSTOM_FIELDS_VALIDATION_EXCEPTION,
) {
const XHR = ('onload' in new win.XMLHttpRequest()) ? win.XMLHttpRequest : win.XDomainRequest;

const fieldErrorClassName = 'st-signupform-validation-error';

function stGetFormServerErrorMessage(form) {
    return form.querySelector('.st-signupform-server-error-message');
}

function stGetFormTermsAgreedError(form) {
    return form.querySelector('.st-signupform-terms-agreed-error');
}

function stGetSubmitButton(form) {
    return form.querySelector('#subscribeNow');
}

function stSetServerErrorMessage(form, message) {
    const formServerErrorMessage = stGetFormServerErrorMessage(form);
    formServerErrorMessage.innerText = message;

    if (message) {
    formServerErrorMessage.classList.add("st-hidden");
    } else {
    formServerErrorMessage.classList.remove("st-hidden");
    }
}

function stIsTermsAgreedAccepted(form) {
    return form.querySelector('input[name="terms-agreed"]').checked;
}
function stShowTermsAgreedError(form) {
    const submitButton = stGetSubmitButton(form);
    const formTermsAgreedError = stGetFormTermsAgreedError(form);
    submitButton.disabled = false;
    formTermsAgreedError.classList.remove("st-hidden");
}
function stHideTermsAgreedError(form) {
    const formTermsAgreedError = stGetFormTermsAgreedError(form);
    formTermsAgreedError.classList.add("st-hidden");
}

function stClearFormErrors(form) {
    const fields = form.querySelectorAll(`.${fieldErrorClassName}`);

    fields.forEach(function (field) {
    field.classList.remove(fieldErrorClassName);
    const fieldError = form.querySelector(`#js-error-${field.name}`);
    fieldError.innerText = '';
    });

    stSetServerErrorMessage(form, '');
    stHideTermsAgreedError(form);
}

function stCollectFormData(form) {
    const formData = new FormData(form);

    const data = {
    webFormId,
    fieldValues: {},
    listIds: [],
    };

    formData.forEach(function (value, name) {
    if (name === 'list') {
        data.listIds.push(value);
    } else if (name === 'phone') {
        data.fieldValues[name] = value.replace(/\D/g, '');
    } else if (!['terms-agreed', 'webFormId'].includes(name)) {
        data.fieldValues[name] = value;
    }
    });

    return data;
}

function stConvertServerErrorMessage(fieldName, errorMessage) {
    const field = formFields.find(formField => formField.name === fieldName);

    if (errorMessage === 'Required field value is empty') {
    return `${field.label} is required`;
    } else {
    if (field.type === 'phone') {
        return `${field.label} is required in (XXX) XXX-XXXX format`;
    } else if (field.type === 'date') {
        return `${field.label} is required in MM/DD/YYYY format`;
    } else if (field.type === 'zipCode') {
        if (field.format === 'US') {
        return `${field.label} is required in XXXXX format`;
        } else {
        return `${field.label} is required in XXX-XXX format`;
        }
    } else if (field.type === 'url') {
        return `${field.label} is required in http(s)://xxxxxx.xx format`;
    } else if (field.type === 'gender') {
        return `${field.label} is required in M, m, F, f, Male, Female, male, female format`;
    } else if (field.type === 'number') {
        return `${field.label} is required in number format`;
    } else if (field.name === 'birthday') {
        return `${field.label} is required in MM/DD/YYYY format`;
    }

    return errorMessage;
    }
}

function stParseServerValidationError(response) {
    let results;

    try {
    const error = win.JSON.parse(response);

    if (error.code === DUPLICATE_PHONE_EXCEPTION) {
        results = [
        {
            fieldName: 'phone',
            errorMessage: 'Phone number already exists.'
        }
        ];
    } else if (error.code === DUPLICATE_EMAIL_EXCEPTION) {
        results = [
        {
            fieldName: 'email',
            errorMessage: 'Email already exists.'
        }
        ];
    } else if (error.code === CUSTOM_FIELDS_VALIDATION_EXCEPTION) {
        results = Object.entries(error.reasons).map(([key, value]) => ({
        fieldName: key,
        errorMessage: stConvertServerErrorMessage(key, value)
        }));
    } else {
        results = [
        {
            fieldName: error.invalidValueName,
            errorMessage: stConvertServerErrorMessage(key, error.reason)
        }
        ];
    }
    } catch (error) {
    results = [
        {
        fieldName: '',
        errorMessage: 'Validation error.'
        }
    ];
    }

    return results;
}

function stHandleLoadForm(form) {
    const submitButton = stGetSubmitButton(form);
    if (this.status === 200) {
    const formData = new FormData(form);
    const confirmationTextEl = form.querySelector('.step2-confirmationText');
    confirmationTextEl.innerText = confirmationTextEl.innerText.replace('%%phone%%', formData.get('phone'));

    form.querySelector('.step1-form').style.display = 'none';
    confirmationTextEl.style.display = 'block';

    form.reset();
    } else if (this.status === 418) {
    submitButton.disabled = false;
    const validations = stParseServerValidationError(this.responseText);

    if (validations.length > 0) {
        if (validations[0].fieldName) {
        validations.forEach((validation) => {
            const fields =
                form.querySelectorAll(
                    `input[name="${validation.fieldName}"], textarea[name="${validation.fieldName}"]`
                );
            fields.forEach((field) => {
            field.classList.add(fieldErrorClassName);
            });
            const fieldError =
                form.querySelector(`#js-error-${validation.fieldName}`);
            fieldError.innerText = validation.errorMessage;
        });
        } else {
        stSetServerErrorMessage(form, validations[0].errorMessage);
        }
    } else {
        stSetServerErrorMessage(form, 'Internal Error. Please, try later.');
    }
    } else {
    submitButton.disabled = false;
    stSetServerErrorMessage(form, 'Internal Error. Please, try later.');
    }
}

function stHandleErrorForm(form) {
    const submitButton = stGetSubmitButton(form);
    submitButton.disabled = false;
    stSetServerErrorMessage(form, 'Internal Error. Please, try later.');
}

function stSendForm(form) {
    const data = stCollectFormData(form);
    const url = `${form.action}?r=${Date.now()}`;
    const request = new XHR();

    request.open(form.method, url);

    request.onload = function () { stHandleLoadForm.call(this, form) };
    request.onerror = function () { stHandleErrorForm.call(this, form) };
    request.ontimeout = function () { stHandleErrorForm.call(this, form) };

    try {
    request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    } catch (_) { /* ignore if we can't set headers */
    }

    request.send(win.JSON.stringify(data));
}

function stHandleSubmitForm(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = stGetSubmitButton(form);

    try {
    submitButton.disabled = true;
    stClearFormErrors(form);

    if (!stIsTermsAgreedAccepted(form)) {
        stShowTermsAgreedError(form);
    } else {
        stSendForm(form);
    }
    } catch (e) {
    console.error(e);
    stSetServerErrorMessage(form, 'Internal Error. Please, try later.');
    submitButton.disabled = false;
    }
}

function stFormatPhone(value) {
    const numbers = value.replace(/\D/g, '');
    const firstPart = numbers.substring(0, 3);
    const secondPart = numbers.substring(3, 6);
    const thirdPart = numbers.substring(6, 10);
    let result = '';

    if (firstPart) {
    result += `(${firstPart}`;
    }

    if (secondPart) {
    result += `) ${secondPart}`;
    }

    if (thirdPart) {
    result += `-${thirdPart}`;
    }

    return result;
}

function stHandleChangePhoneField(event) {
    const field = event.currentTarget;
    field.value = stFormatPhone(field.value);
}

function stHandleChangeDateField(event) {
    const field = event.currentTarget;
    const numbers = field.value.replace(/\D/g, '');
    const month = numbers.substr(0, 2);
    const day = numbers.substr(2, 2);
    const year = numbers.substr(4, 4);
    field.value = `${month}${day ? `/${day}` : ''}${year ? `/${year}` : ''}`;
}

function stHandleChangeZipCodeField(event) {
    const field = event.currentTarget;
    field.value = field.value.replace(/\D/g, '').substr(0, 5);
}

function stHandleChangePostalCodeField(event) {
    const field = event.currentTarget;
    const numbers = field.value.replace(/([^a-zA-Z0-9])/g, '');
    const code1 = numbers.substr(0, 3);
    const code2 = numbers.substr(3, 3);
    field.value = `${code1}${code2 ? `-${code2}` : ''}`;
}

function stHandleChangeNumberField(event) {
    const field = event.currentTarget;
    field.value = field.value.replace(/[^0-9,.]/g, '');
}

function stHandleLoad() {
    const forms = doc.querySelectorAll(`#st-join-web-form-${webFormId}`);

    for(let i=0; i<forms.length; i++) {
    const form = forms[i];

    if (!form.hasAttribute('data-form-initialized')) {
        form.setAttribute('data-form-initialized', true);
        form.addEventListener('submit', stHandleSubmitForm);

        const phoneFields = form.querySelectorAll('input[data-type="phone"]');
        phoneFields.forEach(function (field) {
        field.addEventListener('input', stHandleChangePhoneField);
        });

        const dateFields = form.querySelectorAll('input[data-type="date"]');
        dateFields.forEach(function (field) {
        field.addEventListener('input', stHandleChangeDateField);
        });

        const postalCodeFields = form.querySelectorAll('input[data-type="zipCode"][data-format="CA"]');
        postalCodeFields.forEach(function (field) {
        field.addEventListener('input', stHandleChangePostalCodeField);
        });

        const zipCodeFields = form.querySelectorAll('input[data-type="zipCode"][data-format="US"]');
        zipCodeFields.forEach(function (field) {
        field.addEventListener('input', stHandleChangeZipCodeField);
        });

        const numberFields = form.querySelectorAll('input[data-type="number"]');
        numberFields.forEach(function (field) {
        field.addEventListener('input', stHandleChangeNumberField);
        });

        const agreedFields = form.querySelector(`#terms-agreed-checkbox-${webFormId}`);
        agreedFields.id += `-${i.toString(10)}`;
        const agreedTerms = form.querySelector('.st-terms-and-conditions-text');
        agreedTerms.setAttribute('for', agreedFields.id);
    }
    }
}

win.addEventListener('load', stHandleLoad);
})
(
    window, 
    document, 
    '65495f3d75d75166e5edfbfa', 
    [{"name":"phone","label":"Phone","placeholder":"(XXX) XXX-XXXX","type":"phone","value":"","required":true}],
    'DuplicateContactEmailException', 
    'DuplicateContactPhoneException', 'CustomFieldsValidationException'
);