/// <reference path="../node_modules/@types/xrm/index.d.ts" />
var XrmEx;
(function (XrmEx) {
    /**
     * Throws an error with the given error message.
     * @param {string} errorMessage - The error message to throw.
     * @throws {Error} - Always throws an error with the given error message.
     */
    function throwError(errorMessage) {
        throw new Error(errorMessage);
    }
    XrmEx.throwError = throwError;
    /**
     * Returns current state of client whether it's online or offline. This method
     * is of qustionable usefulness for it provides little to no benefit over using
     * the native Xrm SDK method. You decide, dear programmer!
     * @returns boolean
     */
    function isOffline() {
        return Xrm.Utility.getGlobalContext().client.isOffline();
    }
    XrmEx.isOffline = isOffline;
    // /**
    //  * Returns native SDK WebApi appropriate for the current client state
    //  * @returns Xrm.WebApiOffline or Xrm.WebApiOnline
    //  */
    // function getXrmWebApi(): Xrm.WebApiOffline | Xrm.WebApiOnline {
    //   if (isOffline() === true) {
    //     return Xrm.WebApi.offline;
    //   } else {
    //     return Xrm.WebApi.online;
    //   }
    // }
    /**
     * Returns the name of the calling function.
     * @returns {string} - The name of the calling function.
     */
    function getFunctionName() {
        try {
            const error = new Error();
            const stackTrace = error.stack?.split("\n").map((line) => line.trim());
            const callingFunctionLine = stackTrace && stackTrace.length >= 3 ? stackTrace[2] : undefined;
            const functionNameMatch = callingFunctionLine?.match(/at\s+([^\s]+)\s+\(/) ||
                callingFunctionLine?.match(/at\s+([^\s]+)/);
            const functionName = functionNameMatch ? functionNameMatch[1] : "";
            return functionName;
        }
        catch (error) {
            throw new Error(`XrmEx.getFunctionName:\n${error.message}`);
        }
    }
    XrmEx.getFunctionName = getFunctionName;
    /**
     * Displays a notification for an app with the given message and level, and lets you specify whether to show a close button.
     * @param {string} message - The message to display in the notification.
     * @param {'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO'} level - The level of the notification. Can be 'SUCCESS', 'ERROR', 'WARNING', or 'INFO'.
     * @param {boolean} [showCloseButton=false] - Whether to show a close button on the notification. Defaults to false.
     * @returns {Promise<string>} - A promise that resolves with the ID of the created notification.
     */
    async function addGlobalNotification(message, level, showCloseButton = false) {
        const levelMap = {
            SUCCESS: 1,
            ERROR: 2,
            WARNING: 3,
            INFO: 4,
        };
        const messageLevel = levelMap[level] || levelMap.INFO;
        const notification = {
            type: 2,
            level: messageLevel,
            message,
            showCloseButton,
        };
        try {
            return await Xrm.App.addGlobalNotification(notification);
        }
        catch (error) {
            throw new Error(`XrmEx.${getFunctionName()}:\n${error.message}`);
        }
    }
    XrmEx.addGlobalNotification = addGlobalNotification;
    /**
     * Clears a notification in the app with the given unique ID.
     * @param {string} uniqueId - The unique ID of the notification to clear.
     * @returns {Promise<string>} - A promise that resolves when the notification has been cleared.
     */
    async function removeGlobalNotification(uniqueId) {
        try {
            return await Xrm.App.clearGlobalNotification(uniqueId);
        }
        catch (error) {
            throw new Error(`XrmEx.${getFunctionName()}:\n${error.message}`);
        }
    }
    XrmEx.removeGlobalNotification = removeGlobalNotification;
    /**
     * Retrieves the value of an environment variable by using its schema name as key.
     * If the environment variable has both a default value and a current value, this function will retrieve the current value.
     * @param {string} environmentVariableSchemaName - The schema name of the environment variable to retrieve.
     * @returns {Promise<string>} - A promise that resolves with the value of the environment variable.
     * @async
     */
    async function getEnvironmentVariableValue(environmentVariableSchemaName) {
        let response = await executeFunction("RetrieveEnvironmentVariableValue", [
            {
                Name: "DefinitionSchemaName",
                Type: "String",
                Value: environmentVariableSchemaName,
            },
        ]);
        return Object.hasOwn(response, "Value") ? response.Value : response;
    }
    XrmEx.getEnvironmentVariableValue = getEnvironmentVariableValue;
    /**
     * A map of CRM data types to their corresponding type names, structural properties, and JavaScript types.
     * @type {Object.<string, { typeName: string, structuralProperty: number, jsType: string }>}
     */
    let typeMap = {
        String: { typeName: "Edm.String", structuralProperty: 1, jsType: "string" },
        Integer: { typeName: "Edm.Int32", structuralProperty: 1, jsType: "number" },
        Boolean: {
            typeName: "Edm.Boolean",
            structuralProperty: 1,
            jsType: "boolean",
        },
        DateTime: {
            typeName: "Edm.DateTimeOffset",
            structuralProperty: 1,
            jsType: "object",
        },
        EntityReference: {
            typeName: "mscrm.crmbaseentity",
            structuralProperty: 5,
            jsType: "object",
        },
        Decimal: {
            typeName: "Edm.Decimal",
            structuralProperty: 1,
            jsType: "number",
        },
        Entity: {
            typeName: "mscrm.crmbaseentity",
            structuralProperty: 5,
            jsType: "object",
        },
        EntityCollection: {
            typeName: "Collection(mscrm.crmbaseentity)",
            structuralProperty: 4,
            jsType: "object",
        },
        Float: { typeName: "Edm.Double", structuralProperty: 1, jsType: "number" },
        Money: { typeName: "Edm.Decimal", structuralProperty: 1, jsType: "number" },
        Picklist: {
            typeName: "Edm.Int32",
            structuralProperty: 1,
            jsType: "number",
        },
    };
    /**
     * Checks if the given request parameter is of a supported type and has a valid value.
     * @param {RequestParameter} requestParameter - The request parameter to check.
     * @returns {void}
     * @throws {Error} - Throws an error if the request parameter is not of a supported type or has an invalid value.
     */
    function checkRequestParameterType(requestParameter) {
        if (!typeMap[requestParameter.Type])
            throw new Error(`The property type ${requestParameter.Type} of the property ${requestParameter.Name} is not supported.`);
        const expectedType = typeMap[requestParameter.Type].jsType;
        const actualType = typeof requestParameter.Value;
        const invalidTypeMessage = `The value ${requestParameter.Value}\nof the property ${requestParameter.Name}\nis not of the expected type ${requestParameter.Type}.`;
        if (requestParameter.Type === "EntityReference" ||
            requestParameter.Type === "Entity") {
            if (!requestParameter.Value ||
                !requestParameter.Value.hasOwnProperty("id") ||
                !requestParameter.Value.hasOwnProperty("entityType")) {
                throw new Error(invalidTypeMessage);
            }
            typeMap[requestParameter.Type].typeName = `mscrm.${requestParameter.Value.entityType}`;
        }
        else if (requestParameter.Type === "EntityCollection") {
            if (!Array.isArray(requestParameter.Value) ||
                requestParameter.Value.every((v) => typeof v !== "object" ||
                    !v ||
                    !v.hasOwnProperty("id") ||
                    !v.hasOwnProperty("entityType"))) {
                throw new Error(invalidTypeMessage);
            }
        }
        else if (requestParameter.Type === "DateTime") {
            if (!(requestParameter.Value instanceof Date)) {
                throw new Error(invalidTypeMessage);
            }
        }
        else {
            if (actualType !== expectedType) {
                throw new Error(invalidTypeMessage);
            }
        }
    }
    XrmEx.checkRequestParameterType = checkRequestParameterType;
    /**
     * Executes an Action.
     * @param {string} actionName - The unique name of the action.
     * @param {RequestParameter[]} requestParameters - An array of objects with the parameter name, type and value.
     * @param {EntityReference} [boundEntity] - An optional EntityReference of the bound entity.
     * @returns {Promise<any>} - A Promise with the request response.
     * @throws {Error} - Throws an error if the request parameter is not of a supported type or has an invalid value.
     */
    async function executeAction(actionName, requestParameters, boundEntity) {
        const parameterDefinition = {};
        if (boundEntity)
            requestParameters.push({
                Name: "entity",
                Value: boundEntity,
                Type: "EntityReference",
            });
        for (const requestParameter of requestParameters) {
            checkRequestParameterType(requestParameter);
            parameterDefinition[requestParameter.Name] = {
                typeName: typeMap[requestParameter.Type].typeName,
                structuralProperty: typeMap[requestParameter.Type].structuralProperty,
            };
        }
        const req = Object.assign({
            getMetadata: () => ({
                boundParameter: boundEntity ? "entity" : null,
                operationType: 0,
                operationName: actionName,
                parameterTypes: parameterDefinition,
            }),
        }, ...requestParameters.map((p) => ({ [p.Name]: p.Value })));
        const response = await Xrm.WebApi.online.execute(req);
        if (response.ok)
            return response.json().catch(() => response);
    }
    XrmEx.executeAction = executeAction;
    /**
     * Executes a Function.
     * @param {string} functionName - The unique name of the function.
     * @param {RequestParameter[]} requestParameters - An array of objects with the parameter name, type and value.
     * @param {EntityReference} [boundEntity] - An optional EntityReference of the bound entity.
     * @returns {Promise<any>} - A Promise with the request response.
     * @throws {Error} - Throws an error if the request parameter is not of a supported type or has an invalid value.
     */
    async function executeFunction(functionName, requestParameters, boundEntity) {
        const parameterDefinition = {};
        if (boundEntity)
            requestParameters.push({
                Name: "entity",
                Value: boundEntity,
                Type: "EntityReference",
            });
        for (const requestParameter of requestParameters) {
            checkRequestParameterType(requestParameter);
            parameterDefinition[requestParameter.Name] = {
                typeName: typeMap[requestParameter.Type].typeName,
                structuralProperty: typeMap[requestParameter.Type].structuralProperty,
            };
        }
        const req = Object.assign({
            getMetadata: () => ({
                boundParameter: boundEntity ? "entity" : null,
                operationType: 1,
                operationName: functionName,
                parameterTypes: parameterDefinition,
            }),
        }, ...requestParameters.map((p) => ({ [p.Name]: p.Value })));
        const response = await Xrm.WebApi.online.execute(req);
        if (response.ok)
            return response.json().catch(() => response);
    }
    XrmEx.executeFunction = executeFunction;
    /**
     * Makes a GUID lowercase and removes brackets.
     * @param {string} guid - The GUID to normalize.
     * @returns {string} - The normalized GUID.
     */
    function normalizeGuid(guid) {
        if (typeof guid !== "string")
            throw new Error(`XrmEx.normalizeGuid:\n'${guid}' is not a string`);
        return guid.toLowerCase().replace(/[{}]/g, "");
    }
    XrmEx.normalizeGuid = normalizeGuid;
    /**
     * Wraps a function that takes a callback as its last parameter and returns a Promise.
     * @param {Function} fn the function to wrap
     * @param context the parent property of the function f.e. formContext.data.process for formContext.data.process.getEnabledProcesses
     * @param args the arguments to pass to the function
     * @returns {Promise<any>} a Promise that resolves with the callback response
     */
    function asPromise(fn, context, ...args) {
        return new Promise((resolve, reject) => {
            const callback = (response) => {
                resolve(response);
            };
            try {
                // Call the function with the arguments and the callback at the end
                fn.call(context, ...args, callback);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    XrmEx.asPromise = asPromise;
    /**
     * Opens a dialog with dynamic height and width based on text content.
     * @param {string} title - The title of the dialog.
     * @param {string} text - The text content of the dialog.
     * @returns {Promise<any>} - A Promise with the dialog response.
     */
    async function openAlertDialog(title, text) {
        try {
            const rows = text.split(/\r\n|\r|\n/);
            let additionalRows = 0;
            rows.forEach((row) => {
                let width = getTextWidth(row, "1rem Segoe UI Regular, SegoeUI, Segoe UI");
                if (width > 940) {
                    additionalRows += width / 940;
                }
            });
            const longestRow = rows.reduce((acc, row) => (row.length > acc.length ? row : acc), "");
            const width = Math.min(getTextWidth(longestRow, "1rem Segoe UI Regular, SegoeUI, Segoe UI"), 1000);
            const height = 109 + (rows.length + additionalRows) * 20;
            return await Xrm.Navigation.openAlertDialog({
                confirmButtonLabel: "Ok",
                text,
                title,
            }, {
                height,
                width,
            });
        }
        catch (error) {
            console.error(error.message);
            throw new Error(`XrmEx.${getFunctionName()}:\n${error.message}`);
        }
        /**
         * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
         *
         * @param {String} text The text to be rendered.
         * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
         *
         * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
         */
        function getTextWidth(text, font) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            context.font = font;
            const metrics = context.measureText(text);
            return metrics.width;
        }
    }
    XrmEx.openAlertDialog = openAlertDialog;
    class Process {
        static get data() {
            return Form.formContext.data.process;
        }
        static get ui() {
            return Form.formContext.ui.process;
        }
        /**
         * Use this to add a function as an event handler for the OnPreProcessStatusChange event so that it will be called before the
         * business process flow status changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnPreProcessStatusChange(handler) {
            Form.formContext.data.process.removeOnPreProcessStatusChange(handler);
            return Form.formContext.data.process.addOnPreProcessStatusChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnPreStageChange event so that it will be called before the
         * business process flow stage changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnPreStageChange(handler) {
            Form.formContext.data.process.removeOnPreStageChange(handler);
            return Form.formContext.data.process.addOnPreStageChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnPreProcessStatusChange event so that it will be called when the
         * business process flow status changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnProcessStatusChange(handler) {
            Form.formContext.data.process.removeOnProcessStatusChange(handler);
            return Form.formContext.data.process.addOnProcessStatusChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnStageChange event so that it will be called when the
         * business process flow stage changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnStageChange(handler) {
            Form.formContext.data.process.removeOnStageChange(handler);
            return Form.formContext.data.process.addOnStageChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnStageSelected event so that it will be called
         * when a business process flow stage is selected.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnStageSelected(handler) {
            Form.formContext.data.process.removeOnStageSelected(handler);
            return Form.formContext.data.process.addOnStageSelected(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnPreProcessStatusChange event.
         * @param handler If an anonymous function is set using the addOnPreProcessStatusChange method it
         *                cannot be removed using this method.
         */
        static removeOnPreProcessStatusChange(handler) {
            return Form.formContext.data.process.removeOnPreProcessStatusChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnPreStageChange event.
         * @param handler If an anonymous function is set using the addOnPreStageChange method it
         *                cannot be removed using this method.
         */
        static removeOnPreStageChange(handler) {
            return Form.formContext.data.process.removeOnPreStageChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnProcessStatusChange event.
         * @param handler If an anonymous function is set using the addOnProcessStatusChange method it
         *                cannot be removed using this method.
         */
        static removeOnProcessStatusChange(handler) {
            return Form.formContext.data.process.removeOnProcessStatusChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnStageChange event.
         * @param handler If an anonymous function is set using the addOnStageChange method it
         *                cannot be removed using this method.
         */
        static removeOnStageChange(handler) {
            return Form.formContext.data.process.removeOnStageChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnStageChange event.
         * @param handler If an anonymous function is set using the addOnStageChange method it
         *                cannot be removed using this method.
         */
        static removeOnStageSelected(handler) {
            return Form.formContext.data.process.removeOnStageSelected(handler);
        }
        /**
         * Use this method to asynchronously retrieve the enabled business process flows that the user can switch to for an entity.
         * @returns returns callback response as Promise
         */
        static getEnabledProcesses() {
            return asPromise(Form.formContext.data.process.getEnabledProcesses, Form.formContext.data.process);
        }
        /**
         * Returns all process instances for the entity record that the calling user has access to.
         * @returns returns callback response as Promise
         */
        static getProcessInstances() {
            return asPromise(Form.formContext.data.process.getProcessInstances, Form.formContext.data.process);
        }
        /**
         * Progresses to the next stage.
         * @returns returns callback response as Promise
         */
        static moveNext() {
            return asPromise(Form.formContext.data.process.moveNext, Form.formContext.data.process);
        }
        /**
         * Moves to the previous stage.
         * @returns returns callback response as Promise
         */
        static movePrevious() {
            return asPromise(Form.formContext.data.process.movePrevious, Form.formContext.data.process);
        }
        /**
         * Set a Process as the active process.
         * @param processId The Id of the process to make the active process.
         * @returns returns callback response as Promise
         */
        static setActiveProcess(processId) {
            return asPromise(Form.formContext.data.process.setActiveProcess, Form.formContext.data.process, processId);
        }
        /**
         * Sets a process instance as the active instance
         * @param processInstanceId The Id of the process instance to make the active instance.
         * @returns returns callback response as Promise
         */
        static setActiveProcessInstance(processInstanceId) {
            return asPromise(Form.formContext.data.process.setActiveProcessInstance, Form.formContext.data.process, processInstanceId);
        }
        /**
         * Set a stage as the active stage.
         * @param stageId the Id of the stage to make the active stage.
         * @returns returns callback response as Promise
         */
        static setActiveStage(stageId) {
            return asPromise(Form.formContext.data.process.setActiveStage, Form.formContext.data.process, stageId);
        }
        /**
         * Use this method to set the current status of the process instance
         * @param status The new status for the process
         * @returns returns callback response as Promise
         */
        static setStatus(status) {
            return asPromise(Form.formContext.data.process.setStatus, Form.formContext.data.process, status);
        }
    }
    XrmEx.Process = Process;
    class Fields {
        /**
         * Adds a handler or an array of handlers to be called when the attribute's value is changed.
         * @param fields An array of fields to on which this method should be applied.
         * @param handlers The function reference or an array of function references.
         */
        static addOnChange(fields, handler) {
            fields.forEach((field) => {
                field.addOnChange(handler);
            });
        }
        /**
         * Fire all "on change" event handlers.
         * @param fields An array of fields to on which this method should be applied.
         */
        static fireOnChange(fields) {
            fields.forEach((field) => {
                field.fireOnChange();
            });
        }
        /**
         * Removes the handler from the "on change" event.
         * @param fields An array of fields to on which this method should be applied.
         * @param handler The handler.
         */
        static removeOnChange(fields, handler) {
            fields.forEach((field) => {
                field.removeOnChange(handler);
            });
        }
        /**
         * Sets the required level.
         * @param fields An array of fields to on which this method should be applied.
         * @param requirementLevel The requirement level, as either "none", "required", or "recommended"
         */
        static setRequiredLevel(fields, requirementLevel) {
            fields.forEach((field) => {
                field.setRequiredLevel(requirementLevel);
            });
        }
        /**
         * Sets the submit mode.
         * @param fields An array of fields to on which this method should be applied.
         * @param submitMode The submit mode, as either "always", "never", or "dirty".
         * @default submitMode "dirty"
         * @see {@link XrmEnum.AttributeRequirementLevel}
         */
        static setSubmitMode(fields, submitMode) {
            fields.forEach((field) => {
                field.setSubmitMode(submitMode);
            });
        }
        /**
         * Sets the value.
         * @param fields An array of fields to on which this method should be applied.
         * @param value The value.
         * @remarks Attributes on Quick Create Forms will not save values set with this method.
         */
        static setValue(fields, value) {
            fields.forEach((field) => {
                field.setValue(value);
            });
        }
        /**
         * Sets a value for a column to determine whether it is valid or invalid with a message
         * @param fields An array of fields to on which this method should be applied.
         * @param isValid Specify false to set the column value to invalid and true to set the value to valid.
         * @param message The message to display.
         * @see {@link https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/attributes/setisvalid External Link: setIsValid (Client API reference)}
         */
        static setIsValid(fields, isValid, message) {
            fields.forEach((field) => {
                field.setIsValid(isValid, message);
            });
        }
        /**
         * Sets the required level.
         * @param fields An array of fields to on which this method should be applied.
         * @param required The requirement level, as either false for "none" or true for "required"
         */
        static setRequired(fields, required) {
            fields.forEach((field) => {
                field.setRequired(required);
            });
        }
        /**
         * Sets the state of the control to either enabled, or disabled.
         * @param fields An array of fields to on which this method should be applied.
         * @param disabled true to disable, false to enable.
         */
        static setDisabled(fields, disabled) {
            fields.forEach((field) => {
                field.setDisabled(disabled);
            });
        }
        /**
         * Sets the visibility state.
         * @param fields An array of fields to on which this method should be applied.
         * @param visible true to show, false to hide.
         */
        static setVisible(fields, visible) {
            fields.forEach((field) => {
                field.setVisible(visible);
            });
        }
        /**
         * Sets a control-local notification message.
         * @param fields An array of fields to on which this method should be applied.
         * @param message The message.
         * @param uniqueId Unique identifier.
         * @returns true if it succeeds, false if it fails.
         * @remarks     When this method is used on Microsoft Dynamics CRM for tablets a red "X" icon
         *              appears next to the control. Tapping on the icon will display the message.
         */
        static setNotification(fields, message, uniqueId) {
            fields.forEach((field) => {
                field.setNotification(message, uniqueId);
            });
        }
        /**
         * Displays an error or recommendation notification for a control, and lets you specify actions to execute based on the notification.
         * @param fields An array of fields to on which this method should be applied.
         */
        static addNotification(fields, message, notificationLevel, uniqueId, actions) {
            fields.forEach((field) => {
                field.addNotification(message, notificationLevel, uniqueId, actions);
            });
        }
        /**
         * Clears the notification identified by uniqueId.
         * @param fields An array of fields to on which this method should be applied.
         * @param uniqueId (Optional) Unique identifier.
         * @returns true if it succeeds, false if it fails.
         * @remarks If the uniqueId parameter is not used, the current notification shown will be removed.
         */
        static removeNotification(fields, uniqueId) {
            fields.forEach((field) => {
                field.removeNotification(uniqueId);
            });
        }
    }
    XrmEx.Fields = Fields;
    /**
     * Represents a form in Dynamics 365.
     */
    class Form {
        static _formContext;
        static _executionContext;
        constructor() { }
        /**Gets a reference to the current form context*/
        static get formContext() {
            return this._formContext;
        }
        /**Gets a reference to the current executio context*/
        static get executionContext() {
            return this._executionContext;
        }
        /**Gets a lookup value that references the record.*/
        static get entityReference() {
            return Form.formContext.data.entity.getEntityReference();
        }
        /**Sets a reference to the current form context*/
        static set formContext(context) {
            if (!context)
                throw new Error(`XrmEx.Form.setFormContext: The executionContext or formContext was not passed to the function.`);
            if ("getFormContext" in context) {
                this._executionContext = context;
                this._formContext = context.getFormContext();
            }
            else if ("data" in context)
                this._formContext = context;
            else
                throw new Error(`XrmEx.Form.setFormContext: The passed context is not an executionContext or formContext.`);
        }
        /**Sets a reference to the current execution context*/
        static set executionContext(context) {
            if (!context)
                throw new Error(`XrmEx.Form.setExecutionContext: The executionContext or formContext was not passed to the function.`);
            if ("getFormContext" in context) {
                this._executionContext = context;
                this._formContext = context.getFormContext();
            }
            else if ("data" in context)
                this._formContext = context;
            else
                throw new Error(`XrmEx.Form.setExecutionContext: The passed context is not an executionContext or formContext.`);
        }
        /**Returns true if form is from type create*/
        static get IsCreate() {
            return Form.formContext.ui.getFormType() == 1;
        }
        /**Returns true if form is from type update*/
        static get IsUpdate() {
            return Form.formContext.ui.getFormType() == 2;
        }
        /**Returns true if form is not from type create*/
        static get IsNotCreate() {
            return Form.formContext.ui.getFormType() != 1;
        }
        /**Returns true if form is not from type update*/
        static get IsNotUpdate() {
            return Form.formContext.ui.getFormType() != 2;
        }
        /**
         * Displays a form level notification. Any number of notifications can be displayed and will remain until removed using clearFormNotification.
         * The height of the notification area is limited so each new message will be added to the top.
         * @param message The text of the notification message.
         * @param level The level of the notification which defines how the message will be displayed, such as the icon.
         * ERROR: Notification will use the system error icon.
         * WARNING: Notification will use the system warning icon.
         * INFO: Notification will use the system info icon.
         * @param uniqueId Unique identifier for the notification which is used with clearFormNotification to remove the notification.
         * @returns true if it succeeds, othenprwise false.
         */
        static addFormNotification(message, level, uniqueId) {
            try {
                return Form.formContext.ui.setFormNotification(message, level, uniqueId);
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Clears the form notification described by uniqueId.
         * @param uniqueId Unique identifier.
         * @returns True if it succeeds, otherwise false.
         */
        static removeFormNotification(uniqueId) {
            try {
                return Form.formContext.ui.clearFormNotification(uniqueId);
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a handler to be called when the record is saved.
         */
        static addOnSave(handlers) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    Form.formContext.data.entity.removeOnSave(handler);
                    Form.formContext.data.entity.addOnSave(handler);
                });
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a function to be called after the OnSave is complete.
         * @param handler The handler.
         * @remarks Added in 9.2
         * @see {@link https://docs.microsoft.com/en-us/powerapps/developer/model-driven-apps/clientapi/reference/events/postsave External Link: PostSave Event Documentation}
         */
        static addOnPostSave(handlers) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    Form.formContext.data.entity.removeOnPostSave(handler);
                    Form.formContext.data.entity.addOnPostSave(handler);
                });
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a function to be called when form data is loaded.
         * @param handler The function to be executed when the form data loads. The function will be added to the bottom of the event handler pipeline.
         */
        static addOnLoad(handlers) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    Form.formContext.data.removeOnLoad(handler);
                    Form.formContext.data.addOnLoad(handler);
                });
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a handler to be called when the attribute's value is changed.
         * @param handler The function reference.
         */
        static addOnChange(fields, handlers, execute) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    fields.forEach((field) => {
                        field.removeOnChange(handler);
                        field.addOnChange(handler);
                    });
                });
                if (execute) {
                    fields.forEach((field) => {
                        field.Attribute.fireOnChange();
                    });
                }
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
    }
    XrmEx.Form = Form;
    let Class;
    (function (Class) {
        /**
         * Used to execute methods related to a single Attribute
         */
        class Field {
            static allFields = [];
            Name;
            _attribute;
            constructor(attributeName) {
                const existingField = Field.allFields.find((f) => f.Name === attributeName);
                if (existingField) {
                    return existingField;
                }
                this.Name = attributeName;
                Field.allFields.push(this);
            }
            setValue(value) {
                return this.Attribute.setValue(value);
            }
            getAttributeType() {
                return this.Attribute.getAttributeType();
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getIsDirty() {
                return this.Attribute.getIsDirty();
            }
            getName() {
                return this.Attribute.getName();
            }
            getParent() {
                return this.Attribute.getParent();
            }
            getRequiredLevel() {
                return this.Attribute.getRequiredLevel();
            }
            getSubmitMode() {
                return this.Attribute.getSubmitMode();
            }
            getUserPrivilege() {
                return this.Attribute.getUserPrivilege();
            }
            removeOnChange(handler) {
                return this.Attribute.removeOnChange(handler);
            }
            setSubmitMode(submitMode) {
                return this.Attribute.setSubmitMode(submitMode);
            }
            getValue() {
                return this.Attribute.getValue();
            }
            setIsValid(isValid, message) {
                return this.Attribute.setIsValid(isValid, message);
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`The attribute '${this.Name}' was not found on the form.`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            /**
             * Gets the value.
             * @returns The value.
             */
            get Value() {
                return this.Attribute.getValue();
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
            /**
             * Sets a control-local notification message.
             * @param message The message.
             * @param uniqueId Unique identifier.
             * @returns true if it succeeds, false if it fails.
             * @remarks     When this method is used on Microsoft Dynamics CRM for tablets a red "X" icon
             *              appears next to the control. Tapping on the icon will display the message.
             */
            setNotification(message, uniqueId) {
                try {
                    if (!message)
                        throw new Error(`no message was provided.`);
                    if (!uniqueId)
                        throw new Error(`no uniqueId was provided.`);
                    this.controls.forEach((control) => control.setNotification(message, uniqueId));
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the visibility state.
             * @param visible true to show, false to hide.
             */
            setVisible(visible) {
                try {
                    this.controls.forEach((control) => control.setVisible(visible));
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the state of the control to either enabled, or disabled.
             * @param disabled true to disable, false to enable.
             */
            setDisabled(disabled) {
                try {
                    this.controls.forEach((control) => control.setDisabled(disabled));
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the required level.
             * @param requirementLevel The requirement level, as either "none", "required", or "recommended"
             */
            setRequiredLevel(requirementLevel) {
                try {
                    this.Attribute.setRequiredLevel(requirementLevel);
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the required level.
             * @param required The requirement level, as either false for "none" or true for "required"
             */
            setRequired(required) {
                try {
                    this.Attribute.setRequiredLevel(required ? "required" : "none");
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**Fire all "on change" event handlers. */
            fireOnChange() {
                try {
                    this.Attribute.fireOnChange();
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Adds a handler or an array of handlers to be called when the attribute's value is changed.
             * @param handlers The function reference or an array of function references.
             */
            addOnChange(handlers) {
                try {
                    if (Array.isArray(handlers)) {
                        for (const handler of handlers) {
                            if (typeof handler !== "function")
                                throw new Error(`'${handler}' is not a function`);
                            this.Attribute.removeOnChange(handler);
                            this.Attribute.addOnChange(handler);
                        }
                    }
                    else {
                        if (typeof handlers !== "function")
                            throw new Error(`'${handlers}' is not a function`);
                        this.Attribute.removeOnChange(handlers);
                        this.Attribute.addOnChange(handlers);
                    }
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Displays an error or recommendation notification for a control, and lets you specify actions to execute based on the notification.
             */
            addNotification(message, notificationLevel, uniqueId, actions) {
                try {
                    if (!uniqueId)
                        throw new Error(`no uniqueId was provided.`);
                    if (actions && !Array.isArray(actions))
                        throw new Error(`the action parameter is not an array of ControlNotificationAction`);
                    this.controls.forEach((control) => {
                        control.addNotification({
                            messages: [message],
                            notificationLevel: notificationLevel,
                            uniqueId: uniqueId,
                            actions: actions,
                        });
                    });
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Clears the notification identified by uniqueId.
             * @param uniqueId (Optional) Unique identifier.
             * @returns true if it succeeds, false if it fails.
             * @remarks If the uniqueId parameter is not used, the current notification shown will be removed.
             */
            removeNotification(uniqueId) {
                try {
                    this.controls.forEach((control) => {
                        control.clearNotification(uniqueId);
                    });
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
        }
        Class.Field = Field;
        class TextField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getMaxLength() {
                return this.Attribute.getMaxLength();
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.TextField = TextField;
        class NumberField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getMax() {
                return this.Attribute.getMax();
            }
            getMin() {
                return this.Attribute.getMin();
            }
            getPrecision() {
                return this.Attribute.getPrecision();
            }
            setPrecision(precision) {
                return this.Attribute.setPrecision(precision);
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.NumberField = NumberField;
        class DateField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.DateField = DateField;
        class BooleanField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getAttributeType() {
                return this.Attribute.getAttributeType();
            }
            getInitialValue() {
                return this.Attribute.getInitialValue();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.BooleanField = BooleanField;
        class MultiSelectOptionSetField extends Field {
            Option;
            constructor(attributeName, option) {
                super(attributeName);
                this.Option = option;
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getOption(value) {
                if (typeof value === "number") {
                    return this.Attribute.getOption(value);
                }
                else {
                    return this.Attribute.getOption(value);
                }
            }
            getOptions() {
                return this.Attribute.getOptions();
            }
            getSelectedOption() {
                return this.Attribute.getSelectedOption();
            }
            getText() {
                return this.Attribute.getText();
            }
            getInitialValue() {
                return this.Attribute.getInitialValue();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue();
            }
            set Value(value) {
                if (Array.isArray(value)) {
                    let values = [];
                    value.forEach((v) => {
                        if (typeof v == "number")
                            values.push(v);
                        else
                            values.push(this.Option[v]);
                    });
                    this.Attribute.setValue(values);
                }
                else
                    XrmEx.throwError(`Field Value '${value}' is not an Array`);
            }
        }
        Class.MultiSelectOptionSetField = MultiSelectOptionSetField;
        class LookupField extends Field {
            _customFilters = [];
            _isEntityAvailableOffline = undefined;
            constructor(attribute) {
                super(attribute);
            }
            getIsPartyList() {
                return this.Attribute.getIsPartyList();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            /**Gets the id of the first lookup value*/
            get Id() {
                return this.Value && this.Value.length > 0
                    ? XrmEx.normalizeGuid(this.Value[0].id)
                    : null;
            }
            /**Gets the entityType of the first lookup value*/
            get EntityType() {
                return this.Value && this.Value.length > 0
                    ? this.Value[0].entityType
                    : null;
            }
            /**Gets the formatted value of the first lookup value*/
            get FormattedValue() {
                return this.Value && this.Value.length > 0 ? this.Value[0].name : null;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
            /**
             * Sets the value of a lookup
             * @param id Guid of the record
             * @param entityType logicalname of the entity
             * @param name formatted value
             * @param append if true, adds value to the array instead of replacing it
             */
            setLookupValue(id, entityType, name, append = false) {
                try {
                    if (!id)
                        throw new Error(`no id parameter was provided.`);
                    if (!entityType)
                        throw new Error(`no entityType parameter was provided.`);
                    id = XrmEx.normalizeGuid(id);
                    const lookupValue = {
                        id,
                        entityType,
                        name,
                    };
                    this.Value =
                        append && this.Value
                            ? this.Value.concat(lookupValue)
                            : [lookupValue];
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets a lookup with a lookup from the retrieved record.
             * @param selectName
             * @param retrievedRecord
             * @example
             * var contact = await fields.Contact.retrieve('?$select=_parentcustomerid_value');
             * fields.Account.setLookupFromRetrieve('_parentcustomerid_value', contact);
             * //Alternate
             * fields.Account.setLookupFromRetrieve('parentcustomerid', contact);
             */
            setLookupFromRetrieve(selectName, retrievedRecord) {
                if (!selectName.endsWith("_value"))
                    selectName = `_${selectName}_value`;
                if (!retrievedRecord || !retrievedRecord[`${selectName}`]) {
                    this.Value = null;
                    return;
                }
                this.Value = [
                    {
                        id: retrievedRecord[`${selectName}`],
                        entityType: retrievedRecord[`${selectName}@Microsoft.Dynamics.CRM.lookuplogicalname`],
                        name: retrievedRecord[`${selectName}@OData.Community.Display.V1.FormattedValue`],
                    },
                ];
            }
            /**
             * Returns native SDK WebApi appropriate for the current client state
             * @returns Xrm.WebApiOffline or Xrm.WebApiOnline
             */
            getXrmWebApi() {
                if (isOffline() === true) {
                    if (this._isEntityAvailableOffline === undefined) {
                        this._isEntityAvailableOffline =
                            Xrm.WebApi.offline.isAvailableOffline(this.EntityType);
                        // If property is still undefined at this point, something is
                        // wrong.
                        if (this._isEntityAvailableOffline === undefined) {
                            throwError("Unable to determine offline availability for entity: " +
                                this.EntityType);
                        }
                        // Recursive call to self, value should now be either true or false
                        this.getXrmWebApi();
                    }
                    else if (this._isEntityAvailableOffline === true) {
                        return Xrm.WebApi.offline;
                    }
                    else {
                        throwError("This entity is not available in offline mode");
                    }
                }
                else {
                    return Xrm.WebApi.online;
                }
            }
            /**
             * Retrieves an entity record.
             * @param options (Optional) OData system query options, $select and $expand, to retrieve your data.
             * - Use the $select system query option to limit the properties returned by including a comma-separated
             *   list of property names. This is an important performance best practice. If properties aren’t
             *   specified using $select, all properties will be returned.
             * - Use the $expand system query option to control what data from related entities is returned. If you
             *   just include the name of the navigation property, you’ll receive all the properties for related
             *   records. You can limit the properties returned for related records using the $select system query
             *   option in parentheses after the navigation property name. Use this for both single-valued and
             *   collection-valued navigation properties.
             * - You can also specify multiple query options by using & to separate the query options.
             * @example <caption>options example:</caption>
             * options: $select=name&$expand=primarycontactid($select=contactid,fullname)
             * @returns On success, returns a promise containing a JSON object with the retrieved attributes and their values.
             * @see {@link https://docs.microsoft.com/en-us/dynamics365/customer-engagement/developer/clientapi/reference/xrm-webapi/retrieverecord External Link: retrieveRecord (Client API reference)}
             */
            async retrieve(options) {
                try {
                    if (!this.Id || !this.EntityType)
                        return null;
                    const record = await Xrm.WebApi.retrieveRecord(this.EntityType, this.Id, options);
                    return record;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Updates an entity record.
             * @param data (required) A JSON object containing key : value pairs where key is the attribute of the table
             * and value is the value of the attribute you wish to update.
             * @example <caption>data example:</caption>
             * var data =
             *   {
             *     "name": "Updated Sample Account ",
             *     "creditonhold": true,
             *     "address1_latitude": 47.639583,
             *     "description": "This is the updated description of the sample account",
             *     "revenue": 6000000,
             *     "accountcategorycode": 2
             *   };
             * @returns On success, returns a promise object with entityType (string, table name) and id (string, GUID of the record)
             * @see {@link https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-webapi/updaterecord}
             */
            async update(data) {
                try {
                    if (!this.Id || !this.EntityType || !data) {
                        throwError("Missing required arguments for update method");
                    }
                    const result = await this.getXrmWebApi().updateRecord(this.EntityType, this.Id, data);
                    return result;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Adds an additional custom filter to the lookup, with the "AND" filter operator.
             * @param filter Specifies the filter, as a serialized FetchXML "filter" node.
             * @param entityLogicalName (Optional) The logical name of the entity.
             * @remarks     If entityLogicalName is not specified, the filter will be applied to all entities
             *              valid for the Lookup control.
             * @example     Example filter: <filter type="and">
             *                              <condition attribute="address1_city" operator="eq" value="Redmond" />
             *                              </filter>
             */
            addPreFilterToLookup(filterXml, entityLogicalName) {
                try {
                    _addCustomFilter.controls = this.controls;
                    this.controls.forEach((control) => {
                        control.addPreSearch(_addCustomFilter);
                    });
                    this._customFilters.push(_addCustomFilter);
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
                function _addCustomFilter() {
                    _addCustomFilter.controls.forEach((control) => {
                        control.addCustomFilter(filterXml, entityLogicalName);
                    });
                }
            }
            /**
             * Adds an additional custom filter to the lookup, with the "AND" filter operator.
             * @param entityLogicalName (Optional) The logical name of the entity.
             * @param primaryAttributeIdName (Optional) The logical name of the primary key.
             * @param fetchXml Specifies the FetchXML used to filter.
             * @remarks     If entityLogicalName is not specified, the filter will be applied to all entities
             *              valid for the Lookup control.
             * @example     Example fetchXml: <fetch>
             *                              <entity name="contact">
             *                                  <filter>
             *                                  <condition attribute="address1_city" operator="eq" value="Redmond" />
             *                                  </filter>
             *                              </entity>
             *                              </fetch>
             */
            async addPreFilterToLookupAdvanced(entityLogicalName, primaryAttributeIdName, fetchXml) {
                try {
                    const result = await Xrm.WebApi.online.retrieveMultipleRecords(entityLogicalName, "?fetchXml=" + fetchXml);
                    const data = result.entities;
                    let filteredEntities = "";
                    _addCustomFilter.controls = this.controls;
                    data.forEach((item) => {
                        filteredEntities += `<value>${item[primaryAttributeIdName]}</value>`;
                    });
                    fetchXml = filteredEntities
                        ? `<filter><condition attribute='${primaryAttributeIdName}' operator='in'>${filteredEntities}</condition></filter>`
                        : `<filter><condition attribute='${primaryAttributeIdName}' operator='null'/></filter>`;
                    this.controls.forEach((control) => {
                        control.addPreSearch(_addCustomFilter);
                    });
                    this._customFilters.push(_addCustomFilter);
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
                function _addCustomFilter() {
                    _addCustomFilter.controls.forEach((control) => {
                        control.addCustomFilter(fetchXml, entityLogicalName);
                    });
                }
            }
            /**
             * Removes all filters set on the current lookup attribute by using addPreFilterToLookup or addPreFilterToLookupAdvanced
             */
            clearPreFilterFromLookup() {
                try {
                    this._customFilters.forEach((customFilter) => {
                        this.controls.forEach((control) => {
                            control.removePreSearch(customFilter);
                        });
                    });
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
        }
        Class.LookupField = LookupField;
        class OptionsetField extends Field {
            _control;
            Option;
            constructor(attributeName, option) {
                super(attributeName);
                this.Option = option;
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getOption(value) {
                if (typeof value === "number") {
                    return this.Attribute.getOption(value);
                }
                else {
                    return this.Attribute.getOption(value);
                }
            }
            getOptions() {
                return this.Attribute.getOptions();
            }
            getSelectedOption() {
                return this.Attribute.getSelectedOption();
            }
            getText() {
                return this.Attribute.getText();
            }
            getInitialValue() {
                return this.Attribute.getInitialValue();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get control() {
                return (this._control ??=
                    Form.formContext.getControl(this.Name) ??
                        XrmEx.throwError(`Control '${this.Name}' does not exist`));
            }
            get Value() {
                return this.Attribute.getValue();
            }
            set Value(value) {
                if (typeof value == "number")
                    this.Attribute.setValue(value);
                else
                    this.Attribute.setValue(this.Option[value]);
            }
            /**
             * Adds an option.
             *
             * @param values an array with the option values to add
             * @param index (Optional) zero-based index of the option.
             *
             * @remarks This method does not check that the values within the options you add are valid.
             *          If index is not provided, the new option will be added to the end of the list.
             */
            addOption(values, index) {
                try {
                    if (!Array.isArray(values))
                        throw new Error(`values is not an Array:\nvalues: '${values}'`);
                    const optionSetValues = this.control.getAttribute().getOptions() ?? [];
                    for (const element of optionSetValues) {
                        if (values.includes(element.value)) {
                            this.control.addOption(element, index);
                        }
                    }
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Removes the option matching the value.
             *
             * @param value The value.
             */
            removeOption(values) {
                try {
                    if (!Array.isArray(values))
                        throw new Error(`values is not an Array:\nvalues: '${values}'`);
                    const optionSetValues = this.control.getAttribute().getOptions() ?? [];
                    for (const element of optionSetValues) {
                        if (values.includes(element.value)) {
                            this.control.removeOption(element.value);
                        }
                    }
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Clears all options.
             */
            clearOptions() {
                try {
                    this.control.clearOptions();
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
        }
        Class.OptionsetField = OptionsetField;
        class Section {
            Name;
            _section;
            parentTab;
            constructor(name) {
                this.Name = name;
            }
            get Section() {
                return (this._section ??=
                    this.parentTab.sections.get(this.Name) ??
                        XrmEx.throwError(`The section '${this.Name}' was not found on the form.`));
            }
            getName() {
                return this.Section.getName();
            }
            getParent() {
                return this.Section.getParent();
            }
            controls;
            setVisible(visible) {
                return this.Section.setVisible(visible);
            }
            getVisible() {
                return this.Section.getVisible();
            }
            getLabel() {
                return this.Section.getLabel();
            }
            setLabel(label) {
                return this.Section.setLabel(label);
            }
        }
        Class.Section = Section;
        class Tab {
            Name;
            _tab;
            Section;
            constructor(name, section) {
                this.Name = name;
                this.Section = section;
                for (let key in section) {
                    section[key].parentTab = this;
                }
            }
            get sections() {
                return this.Tab.sections;
            }
            get Tab() {
                return (this._tab ??=
                    Form.formContext.ui.tabs.get(this.Name) ??
                        XrmEx.throwError(`The tab '${this.Name}' was not found on the form.`));
            }
            addTabStateChange(handler) {
                return this.Tab.addTabStateChange(handler);
            }
            getDisplayState() {
                return this.Tab.getDisplayState();
            }
            getName() {
                return this.Tab.getName();
            }
            getParent() {
                return this.Tab.getParent();
            }
            removeTabStateChange(handler) {
                return this.Tab.removeTabStateChange(handler);
            }
            setDisplayState(displayState) {
                return this.Tab.setDisplayState(displayState);
            }
            setVisible(visible) {
                return this.Tab.setVisible(visible);
            }
            getVisible() {
                return this.Tab.getVisible();
            }
            getLabel() {
                return this.Tab.getLabel();
            }
            setLabel(label) {
                return this.Tab.setLabel(label);
            }
            setFocus() {
                return this.Tab.setFocus();
            }
        }
        Class.Tab = Tab;
        class GridControl {
            Name;
            _gridControl;
            constructor(name) {
                this.Name = name;
            }
            get GridControl() {
                return ((this._gridControl ??=
                    Form.formContext.getControl(this.Name)) ??
                    XrmEx.throwError(`The grid '${this.Name}' was not found on the form.`));
            }
            get Grid() {
                return this.GridControl.getGrid();
            }
            addOnLoad(handler) {
                this.GridControl.removeOnLoad(handler);
                return this.GridControl.addOnLoad(handler);
            }
            getContextType() {
                return this.GridControl.getContextType();
            }
            getEntityName() {
                return this.GridControl.getEntityName();
            }
            getFetchXml() {
                return this.GridControl.getFetchXml();
            }
            getGrid() {
                return this.GridControl.getGrid();
            }
            getRelationship() {
                return this.GridControl.getRelationship();
            }
            getUrl(client) {
                return this.GridControl.getUrl(client);
            }
            getViewSelector() {
                return this.GridControl.getViewSelector();
            }
            openRelatedGrid() {
                return this.GridControl.openRelatedGrid();
            }
            refresh() {
                return this.GridControl.refresh();
            }
            refreshRibbon() {
                return this.GridControl.refreshRibbon();
            }
            removeOnLoad(handler) {
                return this.GridControl.removeOnLoad(handler);
            }
            getControlType() {
                return this.GridControl.getControlType();
            }
            getName() {
                return this.GridControl.getName();
            }
            getParent() {
                return this.GridControl.getParent();
            }
            getLabel() {
                return this.GridControl.getLabel();
            }
            setLabel(label) {
                return this.GridControl.setLabel(label);
            }
            getVisible() {
                return this.GridControl.getVisible();
            }
            setVisible(visible) {
                return this.GridControl.setVisible(visible);
            }
        }
        Class.GridControl = GridControl;
    })(Class = XrmEx.Class || (XrmEx.Class = {}));
})(XrmEx || (XrmEx = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWHJtRXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvWHJtRXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOERBQThEO0FBa0M5RCxJQUFVLEtBQUssQ0FzK0RkO0FBdCtERCxXQUFVLEtBQUs7SUFDYjs7OztPQUlHO0lBQ0gsU0FBZ0IsVUFBVSxDQUFDLFlBQW9CO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUZlLGdCQUFVLGFBRXpCLENBQUE7SUFDRDs7Ozs7T0FLRztJQUNILFNBQWdCLFNBQVM7UUFDdkIsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQzNELENBQUM7SUFGZSxlQUFTLFlBRXhCLENBQUE7SUFDRCxNQUFNO0lBQ04sd0VBQXdFO0lBQ3hFLG9EQUFvRDtJQUNwRCxNQUFNO0lBQ04sa0VBQWtFO0lBQ2xFLGdDQUFnQztJQUNoQyxpQ0FBaUM7SUFDakMsYUFBYTtJQUNiLGdDQUFnQztJQUNoQyxNQUFNO0lBQ04sSUFBSTtJQUNKOzs7T0FHRztJQUNILFNBQWdCLGVBQWU7UUFDN0IsSUFBSTtZQUNGLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7WUFDMUIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN2RSxNQUFNLG1CQUFtQixHQUN2QixVQUFVLElBQUksVUFBVSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ25FLE1BQU0saUJBQWlCLEdBQ3JCLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQztnQkFDaEQsbUJBQW1CLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzlDLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBRW5FLE9BQU8sWUFBWSxDQUFDO1NBQ3JCO1FBQUMsT0FBTyxLQUFVLEVBQUU7WUFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDN0Q7SUFDSCxDQUFDO0lBZmUscUJBQWUsa0JBZTlCLENBQUE7SUFDRDs7Ozs7O09BTUc7SUFDSSxLQUFLLFVBQVUscUJBQXFCLENBQ3pDLE9BQWUsRUFDZixLQUErQyxFQUMvQyxlQUFlLEdBQUcsS0FBSztRQUV2QixNQUFNLFFBQVEsR0FBRztZQUNmLE9BQU8sRUFBRSxDQUFDO1lBQ1YsS0FBSyxFQUFFLENBQUM7WUFDUixPQUFPLEVBQUUsQ0FBQztZQUNWLElBQUksRUFBRSxDQUFDO1NBQ1IsQ0FBQztRQUNGLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDO1FBQ3RELE1BQU0sWUFBWSxHQUFHO1lBQ25CLElBQUksRUFBRSxDQUFDO1lBQ1AsS0FBSyxFQUFFLFlBQVk7WUFDbkIsT0FBTztZQUNQLGVBQWU7U0FDaEIsQ0FBQztRQUNGLElBQUk7WUFDRixPQUFPLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztTQUMxRDtRQUFDLE9BQU8sS0FBVSxFQUFFO1lBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxlQUFlLEVBQUUsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztTQUNsRTtJQUNILENBQUM7SUF2QnFCLDJCQUFxQix3QkF1QjFDLENBQUE7SUFDRDs7OztPQUlHO0lBQ0ksS0FBSyxVQUFVLHdCQUF3QixDQUM1QyxRQUFnQjtRQUVoQixJQUFJO1lBQ0YsT0FBTyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDeEQ7UUFBQyxPQUFPLEtBQVUsRUFBRTtZQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDbEU7SUFDSCxDQUFDO0lBUnFCLDhCQUF3QiwyQkFRN0MsQ0FBQTtJQUNEOzs7Ozs7T0FNRztJQUNJLEtBQUssVUFBVSwyQkFBMkIsQ0FDL0MsNkJBQXFDO1FBRXJDLElBQUksUUFBUSxHQUFHLE1BQU0sZUFBZSxDQUFDLGtDQUFrQyxFQUFFO1lBQ3ZFO2dCQUNFLElBQUksRUFBRSxzQkFBc0I7Z0JBQzVCLElBQUksRUFBRSxRQUFRO2dCQUNkLEtBQUssRUFBRSw2QkFBNkI7YUFDckM7U0FDRixDQUFDLENBQUM7UUFDSCxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFDdEUsQ0FBQztJQVhxQixpQ0FBMkIsOEJBV2hELENBQUE7SUFDRDs7O09BR0c7SUFDSCxJQUFJLE9BQU8sR0FBRztRQUNaLE1BQU0sRUFBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7UUFDM0UsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxrQkFBa0IsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtRQUMzRSxPQUFPLEVBQUU7WUFDUCxRQUFRLEVBQUUsYUFBYTtZQUN2QixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sRUFBRSxTQUFTO1NBQ2xCO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsUUFBUSxFQUFFLG9CQUFvQjtZQUM5QixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sRUFBRSxRQUFRO1NBQ2pCO1FBQ0QsZUFBZSxFQUFFO1lBQ2YsUUFBUSxFQUFFLHFCQUFxQjtZQUMvQixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sRUFBRSxRQUFRO1NBQ2pCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsUUFBUSxFQUFFLGFBQWE7WUFDdkIsa0JBQWtCLEVBQUUsQ0FBQztZQUNyQixNQUFNLEVBQUUsUUFBUTtTQUNqQjtRQUNELE1BQU0sRUFBRTtZQUNOLFFBQVEsRUFBRSxxQkFBcUI7WUFDL0Isa0JBQWtCLEVBQUUsQ0FBQztZQUNyQixNQUFNLEVBQUUsUUFBUTtTQUNqQjtRQUNELGdCQUFnQixFQUFFO1lBQ2hCLFFBQVEsRUFBRSxpQ0FBaUM7WUFDM0Msa0JBQWtCLEVBQUUsQ0FBQztZQUNyQixNQUFNLEVBQUUsUUFBUTtTQUNqQjtRQUNELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7UUFDMUUsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxrQkFBa0IsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtRQUMzRSxRQUFRLEVBQUU7WUFDUixRQUFRLEVBQUUsV0FBVztZQUNyQixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sRUFBRSxRQUFRO1NBQ2pCO0tBQ0YsQ0FBQztJQUNGOzs7OztPQUtHO0lBQ0gsU0FBZ0IseUJBQXlCLENBQ3ZDLGdCQUFrQztRQUVsQyxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQztZQUNqQyxNQUFNLElBQUksS0FBSyxDQUNiLHFCQUFxQixnQkFBZ0IsQ0FBQyxJQUFJLG9CQUFvQixnQkFBZ0IsQ0FBQyxJQUFJLG9CQUFvQixDQUN4RyxDQUFDO1FBQ0osTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUMzRCxNQUFNLFVBQVUsR0FBRyxPQUFPLGdCQUFnQixDQUFDLEtBQUssQ0FBQztRQUNqRCxNQUFNLGtCQUFrQixHQUFHLGFBQWEsZ0JBQWdCLENBQUMsS0FBSyxxQkFBcUIsZ0JBQWdCLENBQUMsSUFBSSxpQ0FBaUMsZ0JBQWdCLENBQUMsSUFBSSxHQUFHLENBQUM7UUFDbEssSUFDRSxnQkFBZ0IsQ0FBQyxJQUFJLEtBQUssaUJBQWlCO1lBQzNDLGdCQUFnQixDQUFDLElBQUksS0FBSyxRQUFRLEVBQ2xDO1lBQ0EsSUFDRSxDQUFDLGdCQUFnQixDQUFDLEtBQUs7Z0JBQ3ZCLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUM7Z0JBQzVDLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFDcEQ7Z0JBQ0EsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2FBQ3JDO1lBQ0QsT0FBTyxDQUNMLGdCQUFnQixDQUFDLElBQUksQ0FDdEIsQ0FBQyxRQUFRLEdBQUcsU0FBUyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7U0FDM0Q7YUFBTSxJQUFJLGdCQUFnQixDQUFDLElBQUksS0FBSyxrQkFBa0IsRUFBRTtZQUN2RCxJQUNFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7Z0JBQ3RDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQzFCLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FDSixPQUFPLENBQUMsS0FBSyxRQUFRO29CQUNyQixDQUFDLENBQUM7b0JBQ0YsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztvQkFDdkIsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUNsQyxFQUNEO2dCQUNBLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQzthQUNyQztTQUNGO2FBQU0sSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFO1lBQy9DLElBQUksQ0FBQyxDQUFDLGdCQUFnQixDQUFDLEtBQUssWUFBWSxJQUFJLENBQUMsRUFBRTtnQkFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2FBQ3JDO1NBQ0Y7YUFBTTtZQUNMLElBQUksVUFBVSxLQUFLLFlBQVksRUFBRTtnQkFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2FBQ3JDO1NBQ0Y7SUFDSCxDQUFDO0lBOUNlLCtCQUF5Qiw0QkE4Q3hDLENBQUE7SUFDRDs7Ozs7OztPQU9HO0lBQ0ksS0FBSyxVQUFVLGFBQWEsQ0FDakMsVUFBa0IsRUFDbEIsaUJBQXFDLEVBQ3JDLFdBQTZCO1FBRTdCLE1BQU0sbUJBQW1CLEdBQVEsRUFBRSxDQUFDO1FBQ3BDLElBQUksV0FBVztZQUNiLGlCQUFpQixDQUFDLElBQUksQ0FBQztnQkFDckIsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsS0FBSyxFQUFFLFdBQVc7Z0JBQ2xCLElBQUksRUFBRSxpQkFBaUI7YUFDeEIsQ0FBQyxDQUFDO1FBQ0wsS0FBSyxNQUFNLGdCQUFnQixJQUFJLGlCQUFpQixFQUFFO1lBQ2hELHlCQUF5QixDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDNUMsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQzNDLFFBQVEsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUTtnQkFDakQsa0JBQWtCLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLGtCQUFrQjthQUN0RSxDQUFDO1NBQ0g7UUFDRCxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUN2QjtZQUNFLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO2dCQUNsQixjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUk7Z0JBQzdDLGFBQWEsRUFBRSxDQUFDO2dCQUNoQixhQUFhLEVBQUUsVUFBVTtnQkFDekIsY0FBYyxFQUFFLG1CQUFtQjthQUNwQyxDQUFDO1NBQ0gsRUFDRCxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQ3pELENBQUM7UUFDRixNQUFNLFFBQVEsR0FBRyxNQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN0RCxJQUFJLFFBQVEsQ0FBQyxFQUFFO1lBQUUsT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFoQ3FCLG1CQUFhLGdCQWdDbEMsQ0FBQTtJQUVEOzs7Ozs7O09BT0c7SUFDSSxLQUFLLFVBQVUsZUFBZSxDQUNuQyxZQUFvQixFQUNwQixpQkFBcUMsRUFDckMsV0FBNkI7UUFFN0IsTUFBTSxtQkFBbUIsR0FBUSxFQUFFLENBQUM7UUFDcEMsSUFBSSxXQUFXO1lBQ2IsaUJBQWlCLENBQUMsSUFBSSxDQUFDO2dCQUNyQixJQUFJLEVBQUUsUUFBUTtnQkFDZCxLQUFLLEVBQUUsV0FBVztnQkFDbEIsSUFBSSxFQUFFLGlCQUFpQjthQUN4QixDQUFDLENBQUM7UUFDTCxLQUFLLE1BQU0sZ0JBQWdCLElBQUksaUJBQWlCLEVBQUU7WUFDaEQseUJBQXlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUM1QyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRztnQkFDM0MsUUFBUSxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRO2dCQUNqRCxrQkFBa0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsa0JBQWtCO2FBQ3RFLENBQUM7U0FDSDtRQUNELE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQ3ZCO1lBQ0UsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7Z0JBQ2xCLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSTtnQkFDN0MsYUFBYSxFQUFFLENBQUM7Z0JBQ2hCLGFBQWEsRUFBRSxZQUFZO2dCQUMzQixjQUFjLEVBQUUsbUJBQW1CO2FBQ3BDLENBQUM7U0FDSCxFQUNELEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FDekQsQ0FBQztRQUNGLE1BQU0sUUFBUSxHQUFHLE1BQU0sR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RELElBQUksUUFBUSxDQUFDLEVBQUU7WUFBRSxPQUFPLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQWhDcUIscUJBQWUsa0JBZ0NwQyxDQUFBO0lBRUQ7Ozs7T0FJRztJQUNILFNBQWdCLGFBQWEsQ0FBQyxJQUFZO1FBQ3hDLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUTtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixJQUFJLG1CQUFtQixDQUFDLENBQUM7UUFDckUsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBSmUsbUJBQWEsZ0JBSTVCLENBQUE7SUFFRDs7Ozs7O09BTUc7SUFDSCxTQUFnQixTQUFTLENBQUksRUFBWSxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUk7UUFDekQsT0FBTyxJQUFJLE9BQU8sQ0FBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUN4QyxNQUFNLFFBQVEsR0FBRyxDQUFDLFFBQVcsRUFBRSxFQUFFO2dCQUMvQixPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDcEIsQ0FBQyxDQUFDO1lBQ0YsSUFBSTtnQkFDRixtRUFBbUU7Z0JBQ25FLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQ3JDO1lBQUMsT0FBTyxLQUFLLEVBQUU7Z0JBQ2QsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ2Y7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFaZSxlQUFTLFlBWXhCLENBQUE7SUFDRDs7Ozs7T0FLRztJQUNJLEtBQUssVUFBVSxlQUFlLENBQ25DLEtBQWEsRUFDYixJQUFZO1FBRVosSUFBSTtZQUNGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdEMsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDbkIsSUFBSSxLQUFLLEdBQUcsWUFBWSxDQUN0QixHQUFHLEVBQ0gsMENBQTBDLENBQzNDLENBQUM7Z0JBQ0YsSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO29CQUNmLGNBQWMsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDO2lCQUMvQjtZQUNILENBQUMsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FDNUIsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFDbkQsRUFBRSxDQUNILENBQUM7WUFDRixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUNwQixZQUFZLENBQUMsVUFBVSxFQUFFLDBDQUEwQyxDQUFDLEVBQ3BFLElBQUksQ0FDTCxDQUFDO1lBQ0YsTUFBTSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDekQsT0FBTyxNQUFNLEdBQUcsQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUN6QztnQkFDRSxrQkFBa0IsRUFBRSxJQUFJO2dCQUN4QixJQUFJO2dCQUNKLEtBQUs7YUFDTixFQUNEO2dCQUNFLE1BQU07Z0JBQ04sS0FBSzthQUNOLENBQ0YsQ0FBQztTQUNIO1FBQUMsT0FBTyxLQUFVLEVBQUU7WUFDbkIsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxTQUFTLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQ2xFO1FBQ0Q7Ozs7Ozs7V0FPRztRQUNILFNBQVMsWUFBWSxDQUFDLElBQVksRUFBRSxJQUFZO1lBQzlDLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDaEQsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QyxPQUFPLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNwQixNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFDLE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQztRQUN2QixDQUFDO0lBQ0gsQ0FBQztJQXZEcUIscUJBQWUsa0JBdURwQyxDQUFBO0lBRUQsTUFBYSxPQUFPO1FBQ2xCLE1BQU0sS0FBSyxJQUFJO1lBQ2IsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDdkMsQ0FBQztRQUNELE1BQU0sS0FBSyxFQUFFO1lBQ1gsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUM7UUFDckMsQ0FBQztRQUNEOzs7Ozs7Ozs7V0FTRztRQUNILE1BQU0sQ0FBQywyQkFBMkIsQ0FDaEMsT0FBOEM7WUFFOUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3RFLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLDJCQUEyQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFDRDs7Ozs7Ozs7O1dBU0c7UUFDSCxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBMkM7WUFDcEUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzlELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFDRDs7Ozs7Ozs7O1dBU0c7UUFDSCxNQUFNLENBQUMsd0JBQXdCLENBQzdCLE9BQThDO1lBRTlDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNuRSxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBQ0Q7Ozs7Ozs7OztXQVNHO1FBQ0gsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQTJDO1lBQ2pFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMzRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqRSxDQUFDO1FBQ0Q7Ozs7Ozs7OztXQVNHO1FBQ0gsTUFBTSxDQUFDLGtCQUFrQixDQUFDLE9BQTJDO1lBQ25FLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM3RCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBQ0Q7Ozs7V0FJRztRQUNILE1BQU0sQ0FBQyw4QkFBOEIsQ0FDbkMsT0FBOEM7WUFFOUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQ2pFLE9BQU8sQ0FDUixDQUFDO1FBQ0osQ0FBQztRQUNEOzs7O1dBSUc7UUFDSCxNQUFNLENBQUMsc0JBQXNCLENBQUMsT0FBMkM7WUFDdkUsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUNEOzs7O1dBSUc7UUFDSCxNQUFNLENBQUMsMkJBQTJCLENBQ2hDLE9BQThDO1lBRTlDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLDJCQUEyQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFDRDs7OztXQUlHO1FBQ0gsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQTJDO1lBQ3BFLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFDRDs7OztXQUlHO1FBQ0gsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE9BQTJDO1lBQ3RFLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3RFLENBQUM7UUFFRDs7O1dBR0c7UUFDSCxNQUFNLENBQUMsbUJBQW1CO1lBQ3hCLE9BQU8sU0FBUyxDQUNkLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFDakQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUM5QixDQUFDO1FBQ0osQ0FBQztRQUNEOzs7V0FHRztRQUNILE1BQU0sQ0FBQyxtQkFBbUI7WUFDeEIsT0FBTyxTQUFTLENBQ2QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixFQUNqRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQzlCLENBQUM7UUFDSixDQUFDO1FBQ0Q7OztXQUdHO1FBQ0gsTUFBTSxDQUFDLFFBQVE7WUFDYixPQUFPLFNBQVMsQ0FDZCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUN0QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQzlCLENBQUM7UUFDSixDQUFDO1FBQ0Q7OztXQUdHO1FBQ0gsTUFBTSxDQUFDLFlBQVk7WUFDakIsT0FBTyxTQUFTLENBQ2QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFDMUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUM5QixDQUFDO1FBQ0osQ0FBQztRQUNEOzs7O1dBSUc7UUFDSCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsU0FBaUI7WUFDdkMsT0FBTyxTQUFTLENBQ2QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUM5QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQzdCLFNBQVMsQ0FDVixDQUFDO1FBQ0osQ0FBQztRQUNEOzs7O1dBSUc7UUFDSCxNQUFNLENBQUMsd0JBQXdCLENBQUMsaUJBQXlCO1lBQ3ZELE9BQU8sU0FBUyxDQUNkLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsRUFDdEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUM3QixpQkFBaUIsQ0FDbEIsQ0FBQztRQUNKLENBQUM7UUFDRDs7OztXQUlHO1FBQ0gsTUFBTSxDQUFDLGNBQWMsQ0FBQyxPQUFlO1lBQ25DLE9BQU8sU0FBUyxDQUNkLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQzVDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFDN0IsT0FBTyxDQUNSLENBQUM7UUFDSixDQUFDO1FBQ0Q7Ozs7V0FJRztRQUNILE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBcUM7WUFDcEQsT0FBTyxTQUFTLENBQ2QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFDdkMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUM3QixNQUFNLENBQ1AsQ0FBQztRQUNKLENBQUM7S0FDRjtJQXhOWSxhQUFPLFVBd05uQixDQUFBO0lBRUQsTUFBYSxNQUFNO1FBQ2pCOzs7O1dBSUc7UUFDSCxNQUFNLENBQUMsV0FBVyxDQUNoQixNQUFxQixFQUNyQixPQUFnRDtZQUVoRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ3ZCLEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0IsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0Q7OztXQUdHO1FBQ0gsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFxQjtZQUN2QyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ3ZCLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN2QixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRDs7OztXQUlHO1FBQ0gsTUFBTSxDQUFDLGNBQWMsQ0FDbkIsTUFBcUIsRUFDckIsT0FBZ0Q7WUFFaEQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUN2QixLQUFLLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2hDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNEOzs7O1dBSUc7UUFDSCxNQUFNLENBQUMsZ0JBQWdCLENBQ3JCLE1BQXFCLEVBQ3JCLGdCQUFpRDtZQUVqRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ3ZCLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzNDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNEOzs7Ozs7V0FNRztRQUNILE1BQU0sQ0FBQyxhQUFhLENBQ2xCLE1BQXFCLEVBQ3JCLFVBQTBCO1lBRTFCLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDdkIsS0FBSyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNsQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRDs7Ozs7V0FLRztRQUNILE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBcUIsRUFBRSxLQUFVO1lBQy9DLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDdkIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4QixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRDs7Ozs7O1dBTUc7UUFDSCxNQUFNLENBQUMsVUFBVSxDQUNmLE1BQXFCLEVBQ3JCLE9BQWdCLEVBQ2hCLE9BQWdCO1lBRWhCLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDdkIsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDckMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0Q7Ozs7V0FJRztRQUNILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBcUIsRUFBRSxRQUFpQjtZQUN6RCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ3ZCLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDOUIsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0Q7Ozs7V0FJRztRQUNILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBcUIsRUFBRSxRQUFpQjtZQUN6RCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ3ZCLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDOUIsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0Q7Ozs7V0FJRztRQUNILE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBcUIsRUFBRSxPQUFnQjtZQUN2RCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ3ZCLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDNUIsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0Q7Ozs7Ozs7O1dBUUc7UUFDSCxNQUFNLENBQUMsZUFBZSxDQUNwQixNQUFxQixFQUNyQixPQUFlLEVBQ2YsUUFBZ0I7WUFFaEIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUN2QixLQUFLLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUMzQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRDs7O1dBR0c7UUFDSCxNQUFNLENBQUMsZUFBZSxDQUNwQixNQUFxQixFQUNyQixPQUFlLEVBQ2YsaUJBQTZDLEVBQzdDLFFBQWdCLEVBQ2hCLE9BQWtEO1lBRWxELE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDdkIsS0FBSyxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3ZFLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNEOzs7Ozs7V0FNRztRQUNILE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxNQUFxQixFQUFFLFFBQWdCO1lBQy9ELE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDdkIsS0FBSyxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3JDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGO0lBdEtZLFlBQU0sU0FzS2xCLENBQUE7SUFFRDs7T0FFRztJQUNILE1BQWEsSUFBSTtRQUNMLE1BQU0sQ0FBQyxZQUFZLENBQWtCO1FBQ3JDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBMEI7UUFDNUQsZ0JBQWUsQ0FBQztRQUNoQixpREFBaUQ7UUFDakQsTUFBTSxLQUFLLFdBQVc7WUFDcEIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQzNCLENBQUM7UUFDRCxxREFBcUQ7UUFDckQsTUFBTSxLQUFLLGdCQUFnQjtZQUN6QixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUNoQyxDQUFDO1FBQ0Qsb0RBQW9EO1FBQ3BELE1BQU0sS0FBSyxlQUFlO1lBQ3hCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0QsQ0FBQztRQUNELGlEQUFpRDtRQUNqRCxNQUFNLEtBQUssV0FBVyxDQUFDLE9BQWtEO1lBQ3ZFLElBQUksQ0FBQyxPQUFPO2dCQUNWLE1BQU0sSUFBSSxLQUFLLENBQ2IsZ0dBQWdHLENBQ2pHLENBQUM7WUFDSixJQUFJLGdCQUFnQixJQUFJLE9BQU8sRUFBRTtnQkFDL0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQztnQkFDakMsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUM7YUFDOUM7aUJBQU0sSUFBSSxNQUFNLElBQUksT0FBTztnQkFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQzs7Z0JBRXhELE1BQU0sSUFBSSxLQUFLLENBQ2IsMEZBQTBGLENBQzNGLENBQUM7UUFDTixDQUFDO1FBQ0Qsc0RBQXNEO1FBQ3RELE1BQU0sS0FBSyxnQkFBZ0IsQ0FDekIsT0FBa0Q7WUFFbEQsSUFBSSxDQUFDLE9BQU87Z0JBQ1YsTUFBTSxJQUFJLEtBQUssQ0FDYixxR0FBcUcsQ0FDdEcsQ0FBQztZQUNKLElBQUksZ0JBQWdCLElBQUksT0FBTyxFQUFFO2dCQUMvQixJQUFJLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQzthQUM5QztpQkFBTSxJQUFJLE1BQU0sSUFBSSxPQUFPO2dCQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDOztnQkFFeEQsTUFBTSxJQUFJLEtBQUssQ0FDYiwrRkFBK0YsQ0FDaEcsQ0FBQztRQUNOLENBQUM7UUFDRCw2Q0FBNkM7UUFDN0MsTUFBTSxLQUFLLFFBQVE7WUFDakIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUNELDZDQUE2QztRQUM3QyxNQUFNLEtBQUssUUFBUTtZQUNqQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBQ0QsaURBQWlEO1FBQ2pELE1BQU0sS0FBSyxXQUFXO1lBQ3BCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFDRCxpREFBaUQ7UUFDakQsTUFBTSxLQUFLLFdBQVc7WUFDcEIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUVEOzs7Ozs7Ozs7O1dBVUc7UUFDSCxNQUFNLENBQUMsbUJBQW1CLENBQ3hCLE9BQWUsRUFDZixLQUFnQyxFQUNoQyxRQUFnQjtZQUVoQixJQUFJO2dCQUNGLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQzVDLE9BQU8sRUFDUCxLQUFLLEVBQ0wsUUFBUSxDQUNULENBQUM7YUFDSDtZQUFDLE9BQU8sS0FBVSxFQUFFO2dCQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO2FBQ3hFO1FBQ0gsQ0FBQztRQUNEOzs7O1dBSUc7UUFDSCxNQUFNLENBQUMsc0JBQXNCLENBQUMsUUFBZ0I7WUFDNUMsSUFBSTtnQkFDRixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQzVEO1lBQUMsT0FBTyxLQUFVLEVBQUU7Z0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7YUFDeEU7UUFDSCxDQUFDO1FBQ0Q7O1dBRUc7UUFDSCxNQUFNLENBQUMsU0FBUyxDQUNkLFFBRXdDO1lBRXhDLElBQUk7Z0JBQ0YsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUU7b0JBQzVCLFFBQVEsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2lCQUN2QjtnQkFDRCxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7b0JBQzNCLElBQUksT0FBTyxPQUFPLEtBQUssVUFBVSxFQUFFO3dCQUNqQyxNQUFNLElBQUksS0FBSyxDQUFDLElBQUksT0FBTyxxQkFBcUIsQ0FBQyxDQUFDO3FCQUNuRDtvQkFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNuRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNsRCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBQUMsT0FBTyxLQUFVLEVBQUU7Z0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7YUFDeEU7UUFDSCxDQUFDO1FBQ0Q7Ozs7O1dBS0c7UUFDSCxNQUFNLENBQUMsYUFBYSxDQUNsQixRQUV3QztZQUV4QyxJQUFJO2dCQUNGLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUM1QixRQUFRLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztpQkFDdkI7Z0JBQ0QsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO29CQUMzQixJQUFJLE9BQU8sT0FBTyxLQUFLLFVBQVUsRUFBRTt3QkFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLE9BQU8scUJBQXFCLENBQUMsQ0FBQztxQkFDbkQ7b0JBQ0QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN2RCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN0RCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBQUMsT0FBTyxLQUFVLEVBQUU7Z0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7YUFDeEU7UUFDSCxDQUFDO1FBQ0Q7OztXQUdHO1FBQ0gsTUFBTSxDQUFDLFNBQVMsQ0FDZCxRQUV3QztZQUV4QyxJQUFJO2dCQUNGLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUM1QixRQUFRLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztpQkFDdkI7Z0JBQ0QsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO29CQUMzQixJQUFJLE9BQU8sT0FBTyxLQUFLLFVBQVUsRUFBRTt3QkFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLE9BQU8scUJBQXFCLENBQUMsQ0FBQztxQkFDbkQ7b0JBQ0QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUM1QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNDLENBQUMsQ0FBQyxDQUFDO2FBQ0o7WUFBQyxPQUFPLEtBQVUsRUFBRTtnQkFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxTQUFTLEtBQUssQ0FBQyxlQUFlLEVBQUUsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUN4RTtRQUNILENBQUM7UUFDRDs7O1dBR0c7UUFDSCxNQUFNLENBQUMsV0FBVyxDQUNoQixNQUFxQixFQUNyQixRQUV3QyxFQUN4QyxPQUFpQjtZQUVqQixJQUFJO2dCQUNGLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUM1QixRQUFRLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztpQkFDdkI7Z0JBQ0QsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO29CQUMzQixJQUFJLE9BQU8sT0FBTyxLQUFLLFVBQVUsRUFBRTt3QkFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLE9BQU8scUJBQXFCLENBQUMsQ0FBQztxQkFDbkQ7b0JBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO3dCQUN2QixLQUFLLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUM5QixLQUFLLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUM3QixDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztnQkFDSCxJQUFJLE9BQU8sRUFBRTtvQkFDWCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7d0JBQ3ZCLEtBQUssQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUM7b0JBQ2pDLENBQUMsQ0FBQyxDQUFDO2lCQUNKO2FBQ0Y7WUFBQyxPQUFPLEtBQVUsRUFBRTtnQkFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxTQUFTLEtBQUssQ0FBQyxlQUFlLEVBQUUsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUN4RTtRQUNILENBQUM7S0FDRjtJQWpOWSxVQUFJLE9BaU5oQixDQUFBO0lBRUQsSUFBaUIsS0FBSyxDQXdnQ3JCO0lBeGdDRCxXQUFpQixLQUFLO1FBQ3BCOztXQUVHO1FBQ0gsTUFBYSxLQUFLO1lBQ1QsTUFBTSxDQUFDLFNBQVMsR0FBWSxFQUFFLENBQUM7WUFFdEIsSUFBSSxDQUFVO1lBQ3BCLFVBQVUsQ0FBNEI7WUFFaEQsWUFBWSxhQUFxQjtnQkFDL0IsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQ3hDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FDaEMsQ0FBQztnQkFDRixJQUFJLGFBQWEsRUFBRTtvQkFDakIsT0FBTyxhQUFhLENBQUM7aUJBQ3RCO2dCQUNELElBQUksQ0FBQyxJQUFJLEdBQUcsYUFBYSxDQUFDO2dCQUMxQixLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3QixDQUFDO1lBQ0QsUUFBUSxDQUFDLEtBQVU7Z0JBQ2pCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDeEMsQ0FBQztZQUNELGdCQUFnQjtnQkFDZCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQyxDQUFDO1lBQ0QsU0FBUztnQkFDUCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDcEMsQ0FBQztZQUNELFVBQVU7Z0JBQ1IsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3JDLENBQUM7WUFDRCxPQUFPO2dCQUNMLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQyxDQUFDO1lBQ0QsU0FBUztnQkFDUCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDcEMsQ0FBQztZQUNELGdCQUFnQjtnQkFDZCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQyxDQUFDO1lBQ0QsYUFBYTtnQkFDWCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDeEMsQ0FBQztZQUNELGdCQUFnQjtnQkFDZCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQyxDQUFDO1lBQ0QsY0FBYyxDQUFDLE9BQWdEO2dCQUM3RCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2hELENBQUM7WUFDRCxhQUFhLENBQUMsVUFBMEI7Z0JBQ3RDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbEQsQ0FBQztZQUNELFFBQVE7Z0JBQ04sT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25DLENBQUM7WUFDRCxVQUFVLENBQUMsT0FBZ0IsRUFBRSxPQUFnQjtnQkFDM0MsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDckQsQ0FBQztZQUVELElBQVcsU0FBUztnQkFDbEIsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVO29CQUNyQixJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO3dCQUN4QyxLQUFLLENBQUMsVUFBVSxDQUNkLGtCQUFrQixJQUFJLENBQUMsSUFBSSw4QkFBOEIsQ0FDMUQsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztZQUVELElBQVcsUUFBUTtnQkFDakIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNqQyxDQUFDO1lBRUQ7OztlQUdHO1lBQ0gsSUFBVyxLQUFLO2dCQUNkLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxDQUFDO1lBRUQsSUFBVyxLQUFLLENBQUMsS0FBVTtnQkFDekIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakMsQ0FBQztZQUVEOzs7Ozs7O2VBT0c7WUFDSSxlQUFlLENBQUMsT0FBZSxFQUFFLFFBQWdCO2dCQUN0RCxJQUFJO29CQUNGLElBQUksQ0FBQyxPQUFPO3dCQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQztvQkFDMUQsSUFBSSxDQUFDLFFBQVE7d0JBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO29CQUM1RCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQ2hDLE9BQU8sQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUMzQyxDQUFDO29CQUNGLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUFDLE9BQU8sS0FBVSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUNiLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDdEQsQ0FBQztpQkFDSDtZQUNILENBQUM7WUFFRDs7O2VBR0c7WUFDSSxVQUFVLENBQUMsT0FBZ0I7Z0JBQ2hDLElBQUk7b0JBQ0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDaEUsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQUMsT0FBTyxLQUFVLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQ2IsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUN0RCxDQUFDO2lCQUNIO1lBQ0gsQ0FBQztZQUVEOzs7ZUFHRztZQUNJLFdBQVcsQ0FBQyxRQUFpQjtnQkFDbEMsSUFBSTtvQkFDRixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUNsRSxPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFBQyxPQUFPLEtBQVUsRUFBRTtvQkFDbkIsTUFBTSxJQUFJLEtBQUssQ0FDYixTQUFTLEtBQUssQ0FBQyxlQUFlLEVBQUUsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQ3RELENBQUM7aUJBQ0g7WUFDSCxDQUFDO1lBRUQ7OztlQUdHO1lBQ0ksZ0JBQWdCLENBQ3JCLGdCQUFpRDtnQkFFakQsSUFBSTtvQkFDRixJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLENBQUM7b0JBQ2xELE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUFDLE9BQU8sS0FBVSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUNiLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDdEQsQ0FBQztpQkFDSDtZQUNILENBQUM7WUFFRDs7O2VBR0c7WUFDSSxXQUFXLENBQUMsUUFBaUI7Z0JBQ2xDLElBQUk7b0JBQ0YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ2hFLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUFDLE9BQU8sS0FBVSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUNiLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDdEQsQ0FBQztpQkFDSDtZQUNILENBQUM7WUFFRCwwQ0FBMEM7WUFDbkMsWUFBWTtnQkFDakIsSUFBSTtvQkFDRixJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDO29CQUM5QixPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFBQyxPQUFPLEtBQVUsRUFBRTtvQkFDbkIsTUFBTSxJQUFJLEtBQUssQ0FDYixTQUFTLEtBQUssQ0FBQyxlQUFlLEVBQUUsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQ3RELENBQUM7aUJBQ0g7WUFDSCxDQUFDO1lBRUQ7OztlQUdHO1lBQ0ksV0FBVyxDQUNoQixRQUV3QztnQkFFeEMsSUFBSTtvQkFDRixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUU7d0JBQzNCLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFOzRCQUM5QixJQUFJLE9BQU8sT0FBTyxLQUFLLFVBQVU7Z0NBQy9CLE1BQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxPQUFPLHFCQUFxQixDQUFDLENBQUM7NEJBQ3BELElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDOzRCQUN2QyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt5QkFDckM7cUJBQ0Y7eUJBQU07d0JBQ0wsSUFBSSxPQUFPLFFBQVEsS0FBSyxVQUFVOzRCQUNoQyxNQUFNLElBQUksS0FBSyxDQUFDLElBQUksUUFBUSxxQkFBcUIsQ0FBQyxDQUFDO3dCQUNyRCxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQzt3QkFDeEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7cUJBQ3RDO29CQUNELE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUFDLE9BQU8sS0FBVSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUNiLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDdEQsQ0FBQztpQkFDSDtZQUNILENBQUM7WUFFRDs7ZUFFRztZQUNJLGVBQWUsQ0FDcEIsT0FBZSxFQUNmLGlCQUE2QyxFQUM3QyxRQUFnQixFQUNoQixPQUFrRDtnQkFFbEQsSUFBSTtvQkFDRixJQUFJLENBQUMsUUFBUTt3QkFBRSxNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7b0JBQzVELElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7d0JBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQ2IsbUVBQW1FLENBQ3BFLENBQUM7b0JBQ0osSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTt3QkFDaEMsT0FBTyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDOzRCQUNuQixpQkFBaUIsRUFBRSxpQkFBaUI7NEJBQ3BDLFFBQVEsRUFBRSxRQUFROzRCQUNsQixPQUFPLEVBQUUsT0FBTzt5QkFDakIsQ0FBQyxDQUFDO29CQUNMLENBQUMsQ0FBQyxDQUFDO29CQUNILE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUFDLE9BQU8sS0FBVSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUNiLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDdEQsQ0FBQztpQkFDSDtZQUNILENBQUM7WUFDRDs7Ozs7ZUFLRztZQUNILGtCQUFrQixDQUFDLFFBQWdCO2dCQUNqQyxJQUFJO29CQUNGLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7d0JBQ2hDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDdEMsQ0FBQyxDQUFDLENBQUM7b0JBQ0gsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQUMsT0FBTyxLQUFVLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQ2IsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUN0RCxDQUFDO2lCQUNIO1lBQ0gsQ0FBQzs7UUEvUFUsV0FBSyxRQWdRakIsQ0FBQTtRQUNELE1BQWEsU0FDWCxTQUFRLEtBQUs7WUFJYixZQUFZLFNBQWlCO2dCQUMzQixLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDbkIsQ0FBQztZQUNELFlBQVk7Z0JBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3ZDLENBQUM7WUFDRCxTQUFTO2dCQUNQLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQTBDLENBQUM7WUFDNUUsQ0FBQztZQUNELElBQUksU0FBUztnQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVU7b0JBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ3hDLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7WUFDN0QsQ0FBQztZQUNELElBQUksUUFBUTtnQkFDVixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ2pDLENBQUM7WUFDRCxJQUFJLEtBQUs7Z0JBQ1AsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLElBQUksQ0FBQztZQUMzQyxDQUFDO1lBQ0QsSUFBSSxLQUFLLENBQUMsS0FBYTtnQkFDckIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakMsQ0FBQztTQUNGO1FBNUJZLGVBQVMsWUE0QnJCLENBQUE7UUFDRCxNQUFhLFdBQ1gsU0FBUSxLQUFLO1lBSWIsWUFBWSxTQUFpQjtnQkFDM0IsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ25CLENBQUM7WUFDRCxTQUFTO2dCQUNQLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQTJDLENBQUM7WUFDN0UsQ0FBQztZQUNELE1BQU07Z0JBQ0osT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2pDLENBQUM7WUFDRCxNQUFNO2dCQUNKLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQyxDQUFDO1lBQ0QsWUFBWTtnQkFDVixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDdkMsQ0FBQztZQUNELFlBQVksQ0FBQyxTQUFpQjtnQkFDNUIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNoRCxDQUFDO1lBQ0QsSUFBSSxTQUFTO2dCQUNYLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVTtvQkFDckIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQzt3QkFDeEMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxVQUFVLElBQUksQ0FBQyxJQUFJLGtCQUFrQixDQUFDLENBQUMsQ0FBQztZQUM3RCxDQUFDO1lBQ0QsSUFBSSxRQUFRO2dCQUNWLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7WUFDakMsQ0FBQztZQUNELElBQUksS0FBSztnQkFDUCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLElBQUksSUFBSSxDQUFDO1lBQzNDLENBQUM7WUFDRCxJQUFJLEtBQUssQ0FBQyxLQUFhO2dCQUNyQixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNqQyxDQUFDO1NBQ0Y7UUFyQ1ksaUJBQVcsY0FxQ3ZCLENBQUE7UUFDRCxNQUFhLFNBQ1gsU0FBUSxLQUFLO1lBSWIsWUFBWSxTQUFpQjtnQkFDM0IsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ25CLENBQUM7WUFDRCxTQUFTO2dCQUNQLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQXdDLENBQUM7WUFDMUUsQ0FBQztZQUNELElBQUksU0FBUztnQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVU7b0JBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ3hDLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7WUFDN0QsQ0FBQztZQUNELElBQUksUUFBUTtnQkFDVixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ2pDLENBQUM7WUFDRCxJQUFJLEtBQUs7Z0JBQ1AsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLElBQUksQ0FBQztZQUMzQyxDQUFDO1lBQ0QsSUFBSSxLQUFLLENBQUMsS0FBVztnQkFDbkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakMsQ0FBQztTQUNGO1FBekJZLGVBQVMsWUF5QnJCLENBQUE7UUFDRCxNQUFhLFlBQ1gsU0FBUSxLQUFLO1lBSWIsWUFBWSxTQUFpQjtnQkFDM0IsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ25CLENBQUM7WUFDRCxnQkFBZ0I7Z0JBQ2QsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDM0MsQ0FBQztZQUNELGVBQWU7Z0JBQ2IsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzFDLENBQUM7WUFDRCxJQUFJLFNBQVM7Z0JBQ1gsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVO29CQUNyQixJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO3dCQUN4QyxLQUFLLENBQUMsVUFBVSxDQUFDLFVBQVUsSUFBSSxDQUFDLElBQUksa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1lBQzdELENBQUM7WUFDRCxJQUFJLFFBQVE7Z0JBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNqQyxDQUFDO1lBQ0QsSUFBSSxLQUFLO2dCQUNQLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxJQUFJLENBQUM7WUFDM0MsQ0FBQztZQUNELElBQUksS0FBSyxDQUFDLEtBQWM7Z0JBQ3RCLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2pDLENBQUM7U0FDRjtRQTVCWSxrQkFBWSxlQTRCeEIsQ0FBQTtRQUNELE1BQWEseUJBQ1gsU0FBUSxLQUFLO1lBSWIsTUFBTSxDQUFVO1lBQ2hCLFlBQVksYUFBcUIsRUFBRSxNQUFnQjtnQkFDakQsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztZQUN2QixDQUFDO1lBQ0QsU0FBUztnQkFDUCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUE2QyxDQUFDO1lBQy9FLENBQUM7WUFDRCxTQUFTLENBQUMsS0FBc0I7Z0JBQzlCLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO29CQUM3QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUN4QztxQkFBTTtvQkFDTCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUN4QztZQUNILENBQUM7WUFDRCxVQUFVO2dCQUNSLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNyQyxDQUFDO1lBQ0QsaUJBQWlCO2dCQUNmLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzVDLENBQUM7WUFDRCxPQUFPO2dCQUNMLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQyxDQUFDO1lBQ0QsZUFBZTtnQkFDYixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDMUMsQ0FBQztZQUNELElBQUksU0FBUztnQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVU7b0JBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ3hDLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7WUFDN0QsQ0FBQztZQUNELElBQUksUUFBUTtnQkFDVixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ2pDLENBQUM7WUFDRCxJQUFJLEtBQUs7Z0JBQ1AsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25DLENBQUM7WUFDRCxJQUFJLEtBQUssQ0FBQyxLQUFtQztnQkFDM0MsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO29CQUN4QixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7b0JBQ2hCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTt3QkFDbEIsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFROzRCQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7OzRCQUNwQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDbkMsQ0FBQyxDQUFDLENBQUM7b0JBQ0gsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQ2pDOztvQkFBTSxLQUFLLENBQUMsVUFBVSxDQUFDLGdCQUFnQixLQUFLLG1CQUFtQixDQUFDLENBQUM7WUFDcEUsQ0FBQztTQUNGO1FBckRZLCtCQUF5Qiw0QkFxRHJDLENBQUE7UUFDRCxNQUFhLFdBQ1gsU0FBUSxLQUFLO1lBSUgsY0FBYyxHQUFRLEVBQUUsQ0FBQztZQUN6Qix5QkFBeUIsR0FBd0IsU0FBUyxDQUFDO1lBQ3JFLFlBQVksU0FBaUI7Z0JBQzNCLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNuQixDQUFDO1lBQ0QsY0FBYztnQkFDWixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDekMsQ0FBQztZQUNELElBQUksU0FBUztnQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVU7b0JBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ3hDLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7WUFDN0QsQ0FBQztZQUNELElBQUksUUFBUTtnQkFDVixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ2pDLENBQUM7WUFDRCwwQ0FBMEM7WUFDMUMsSUFBSSxFQUFFO2dCQUNKLE9BQU8sSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDO29CQUN4QyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDdkMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUNYLENBQUM7WUFDRCxrREFBa0Q7WUFDbEQsSUFBSSxVQUFVO2dCQUNaLE9BQU8sSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDO29CQUN4QyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVO29CQUMxQixDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ1gsQ0FBQztZQUNELHVEQUF1RDtZQUN2RCxJQUFJLGNBQWM7Z0JBQ2hCLE9BQU8sSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDekUsQ0FBQztZQUNELElBQUksS0FBSztnQkFDUCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLElBQUksSUFBSSxDQUFDO1lBQzNDLENBQUM7WUFDRCxJQUFJLEtBQUssQ0FBQyxLQUF3QjtnQkFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakMsQ0FBQztZQUNEOzs7Ozs7ZUFNRztZQUNILGNBQWMsQ0FDWixFQUFVLEVBQ1YsVUFBZSxFQUNmLElBQVMsRUFDVCxNQUFNLEdBQUcsS0FBSztnQkFFZCxJQUFJO29CQUNGLElBQUksQ0FBQyxFQUFFO3dCQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQztvQkFDMUQsSUFBSSxDQUFDLFVBQVU7d0JBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO29CQUMzRCxFQUFFLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDN0IsTUFBTSxXQUFXLEdBQUc7d0JBQ2xCLEVBQUU7d0JBQ0YsVUFBVTt3QkFDVixJQUFJO3FCQUNMLENBQUM7b0JBQ0YsSUFBSSxDQUFDLEtBQUs7d0JBQ1IsTUFBTSxJQUFJLElBQUksQ0FBQyxLQUFLOzRCQUNsQixDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDOzRCQUNoQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztvQkFDcEIsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQUMsT0FBTyxLQUFVLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQ2IsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUN0RCxDQUFDO2lCQUNIO1lBQ0gsQ0FBQztZQUNEOzs7Ozs7Ozs7ZUFTRztZQUNILHFCQUFxQixDQUNuQixVQUFrQixFQUNsQixlQUFxQztnQkFFckMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO29CQUFFLFVBQVUsR0FBRyxJQUFJLFVBQVUsUUFBUSxDQUFDO2dCQUN4RSxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsVUFBVSxFQUFFLENBQUMsRUFBRTtvQkFDekQsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7b0JBQ2xCLE9BQU87aUJBQ1I7Z0JBQ0QsSUFBSSxDQUFDLEtBQUssR0FBRztvQkFDWDt3QkFDRSxFQUFFLEVBQUUsZUFBZSxDQUFDLEdBQUcsVUFBVSxFQUFFLENBQUM7d0JBQ3BDLFVBQVUsRUFDUixlQUFlLENBQ2IsR0FBRyxVQUFVLDJDQUEyQyxDQUN6RDt3QkFDSCxJQUFJLEVBQUUsZUFBZSxDQUNuQixHQUFHLFVBQVUsNENBQTRDLENBQzFEO3FCQUNGO2lCQUNGLENBQUM7WUFDSixDQUFDO1lBQ0Q7OztlQUdHO1lBQ0gsWUFBWTtnQkFDVixJQUFJLFNBQVMsRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDeEIsSUFBSSxJQUFJLENBQUMseUJBQXlCLEtBQUssU0FBUyxFQUFFO3dCQUNoRCxJQUFJLENBQUMseUJBQXlCOzRCQUM1QixHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7d0JBQ3pELDZEQUE2RDt3QkFDN0QsU0FBUzt3QkFDVCxJQUFJLElBQUksQ0FBQyx5QkFBeUIsS0FBSyxTQUFTLEVBQUU7NEJBQ2hELFVBQVUsQ0FDUix1REFBdUQ7Z0NBQ3JELElBQUksQ0FBQyxVQUFVLENBQ2xCLENBQUM7eUJBQ0g7d0JBRUQsbUVBQW1FO3dCQUNuRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7cUJBQ3JCO3lCQUFNLElBQUksSUFBSSxDQUFDLHlCQUF5QixLQUFLLElBQUksRUFBRTt3QkFDbEQsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztxQkFDM0I7eUJBQU07d0JBQ0wsVUFBVSxDQUFDLDhDQUE4QyxDQUFDLENBQUM7cUJBQzVEO2lCQUNGO3FCQUFNO29CQUNMLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7aUJBQzFCO1lBQ0gsQ0FBQztZQUNEOzs7Ozs7Ozs7Ozs7Ozs7O2VBZ0JHO1lBQ0gsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFlO2dCQUM1QixJQUFJO29CQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7d0JBQUUsT0FBTyxJQUFJLENBQUM7b0JBQzlDLE1BQU0sTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQzVDLElBQUksQ0FBQyxVQUFVLEVBQ2YsSUFBSSxDQUFDLEVBQUUsRUFDUCxPQUFPLENBQ1IsQ0FBQztvQkFDRixPQUFPLE1BQU0sQ0FBQztpQkFDZjtnQkFBQyxPQUFPLEtBQVUsRUFBRTtvQkFDbkIsTUFBTSxJQUFJLEtBQUssQ0FDYixTQUFTLEtBQUssQ0FBQyxlQUFlLEVBQUUsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQ3RELENBQUM7aUJBQ0g7WUFDSCxDQUFDO1lBQ0Q7Ozs7Ozs7Ozs7Ozs7Ozs7ZUFnQkc7WUFDSCxLQUFLLENBQUMsTUFBTSxDQUFDLElBQVk7Z0JBQ3ZCLElBQUk7b0JBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxFQUFFO3dCQUN6QyxVQUFVLENBQUMsOENBQThDLENBQUMsQ0FBQztxQkFDNUQ7b0JBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsWUFBWSxDQUNuRCxJQUFJLENBQUMsVUFBVSxFQUNmLElBQUksQ0FBQyxFQUFFLEVBQ1AsSUFBSSxDQUNMLENBQUM7b0JBRUYsT0FBTyxNQUFNLENBQUM7aUJBQ2Y7Z0JBQUMsT0FBTyxLQUFVLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQ2IsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUN0RCxDQUFDO2lCQUNIO1lBQ0gsQ0FBQztZQUNEOzs7Ozs7Ozs7ZUFTRztZQUNILG9CQUFvQixDQUNsQixTQUFpQixFQUNqQixpQkFBMEI7Z0JBRTFCLElBQUk7b0JBQ0YsZ0JBQWdCLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7b0JBQzFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7d0JBQ2hDLE9BQU8sQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztvQkFDekMsQ0FBQyxDQUFDLENBQUM7b0JBQ0gsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztvQkFDM0MsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQUMsT0FBTyxLQUFVLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQ2IsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUN0RCxDQUFDO2lCQUNIO2dCQUVELFNBQVMsZ0JBQWdCO29CQUN2QixnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7d0JBQzVDLE9BQU8sQ0FBQyxlQUFlLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUM7b0JBQ3hELENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7WUFDSCxDQUFDO1lBQ0Q7Ozs7Ozs7Ozs7Ozs7O2VBY0c7WUFDSCxLQUFLLENBQUMsNEJBQTRCLENBQ2hDLGlCQUF5QixFQUN6QixzQkFBOEIsRUFDOUIsUUFBZ0I7Z0JBRWhCLElBQUk7b0JBQ0YsTUFBTSxNQUFNLEdBQUcsTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsQ0FDNUQsaUJBQWlCLEVBQ2pCLFlBQVksR0FBRyxRQUFRLENBQ3hCLENBQUM7b0JBQ0YsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztvQkFDN0IsSUFBSSxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7b0JBQzFCLGdCQUFnQixDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO29CQUMxQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7d0JBQ3BCLGdCQUFnQixJQUFJLFVBQVUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsQ0FBQztvQkFDdkUsQ0FBQyxDQUFDLENBQUM7b0JBQ0gsUUFBUSxHQUFHLGdCQUFnQjt3QkFDekIsQ0FBQyxDQUFDLGlDQUFpQyxzQkFBc0IsbUJBQW1CLGdCQUFnQix1QkFBdUI7d0JBQ25ILENBQUMsQ0FBQyxpQ0FBaUMsc0JBQXNCLDhCQUE4QixDQUFDO29CQUMxRixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO3dCQUNoQyxPQUFPLENBQUMsWUFBWSxDQUFDLGdCQUFnQixDQUFDLENBQUM7b0JBQ3pDLENBQUMsQ0FBQyxDQUFDO29CQUNILElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7aUJBQzVDO2dCQUFDLE9BQU8sS0FBVSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUNiLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDdEQsQ0FBQztpQkFDSDtnQkFDRCxTQUFTLGdCQUFnQjtvQkFDdkIsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO3dCQUM1QyxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO29CQUN2RCxDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDO1lBQ0gsQ0FBQztZQUNEOztlQUVHO1lBQ0gsd0JBQXdCO2dCQUN0QixJQUFJO29CQUNGLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUN6QixDQUFDLFlBQWdELEVBQUUsRUFBRTt3QkFDbkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTs0QkFDaEMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQzt3QkFDeEMsQ0FBQyxDQUFDLENBQUM7b0JBQ0wsQ0FBQyxDQUNGLENBQUM7b0JBQ0YsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQUMsT0FBTyxLQUFVLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQ2IsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUN0RCxDQUFDO2lCQUNIO1lBQ0gsQ0FBQztTQUNGO1FBblRZLGlCQUFXLGNBbVR2QixDQUFBO1FBSUQsTUFBYSxjQUNYLFNBQVEsS0FBSztZQUlILFFBQVEsQ0FBaUM7WUFDbkQsTUFBTSxDQUFVO1lBQ2hCLFlBQVksYUFBcUIsRUFBRSxNQUFnQjtnQkFDakQsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztZQUN2QixDQUFDO1lBQ0QsU0FBUztnQkFDUCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUE2QyxDQUFDO1lBQy9FLENBQUM7WUFDRCxTQUFTLENBQUMsS0FBc0I7Z0JBQzlCLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO29CQUM3QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUN4QztxQkFBTTtvQkFDTCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUN4QztZQUNILENBQUM7WUFDRCxVQUFVO2dCQUNSLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNyQyxDQUFDO1lBQ0QsaUJBQWlCO2dCQUNmLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzVDLENBQUM7WUFDRCxPQUFPO2dCQUNMLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQyxDQUFDO1lBQ0QsZUFBZTtnQkFDYixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDMUMsQ0FBQztZQUNELElBQUksU0FBUztnQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVU7b0JBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ3hDLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7WUFDN0QsQ0FBQztZQUNELElBQUksUUFBUTtnQkFDVixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ2pDLENBQUM7WUFDRCxJQUFJLE9BQU87Z0JBQ1QsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRO29CQUNuQixJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO3dCQUN0QyxLQUFLLENBQUMsVUFBVSxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1lBQy9ELENBQUM7WUFDRCxJQUFJLEtBQUs7Z0JBQ1AsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25DLENBQUM7WUFDRCxJQUFJLEtBQUssQ0FBQyxLQUE2QjtnQkFDckMsSUFBSSxPQUFPLEtBQUssSUFBSSxRQUFRO29CQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDOztvQkFDeEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ25ELENBQUM7WUFDRDs7Ozs7Ozs7ZUFRRztZQUNILFNBQVMsQ0FBQyxNQUFnQixFQUFFLEtBQWM7Z0JBQ3hDLElBQUk7b0JBQ0YsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO3dCQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO29CQUNsRSxNQUFNLGVBQWUsR0FDbkIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUM7b0JBQ2pELEtBQUssTUFBTSxPQUFPLElBQUksZUFBZSxFQUFFO3dCQUNyQyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFOzRCQUNsQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7eUJBQ3hDO3FCQUNGO29CQUNELE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUFDLE9BQU8sS0FBVSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUNiLFNBQVMsS0FBSyxDQUFDLGVBQWUsRUFBRSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDdEQsQ0FBQztpQkFDSDtZQUNILENBQUM7WUFDRDs7OztlQUlHO1lBQ0gsWUFBWSxDQUFDLE1BQWdCO2dCQUMzQixJQUFJO29CQUNGLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQzt3QkFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDbEUsTUFBTSxlQUFlLEdBQ25CLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDO29CQUNqRCxLQUFLLE1BQU0sT0FBTyxJQUFJLGVBQWUsRUFBRTt3QkFDckMsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTs0QkFDbEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO3lCQUMxQztxQkFDRjtvQkFDRCxPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFBQyxPQUFPLEtBQVUsRUFBRTtvQkFDbkIsTUFBTSxJQUFJLEtBQUssQ0FDYixTQUFTLEtBQUssQ0FBQyxlQUFlLEVBQUUsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQ3RELENBQUM7aUJBQ0g7WUFDSCxDQUFDO1lBQ0Q7O2VBRUc7WUFDSCxZQUFZO2dCQUNWLElBQUk7b0JBQ0YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztvQkFDNUIsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBQUMsT0FBTyxLQUFVLEVBQUU7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQ2IsU0FBUyxLQUFLLENBQUMsZUFBZSxFQUFFLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUN0RCxDQUFDO2lCQUNIO1lBQ0gsQ0FBQztTQUNGO1FBcEhZLG9CQUFjLGlCQW9IMUIsQ0FBQTtRQUNELE1BQWEsT0FBTztZQUNGLElBQUksQ0FBVTtZQUNwQixRQUFRLENBQXdCO1lBQ25DLFNBQVMsQ0FBb0I7WUFDcEMsWUFBWSxJQUFZO2dCQUN0QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNuQixDQUFDO1lBQ0QsSUFBVyxPQUFPO2dCQUNoQixPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVE7b0JBQ25CLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO3dCQUN0QyxLQUFLLENBQUMsVUFBVSxDQUNkLGdCQUFnQixJQUFJLENBQUMsSUFBSSw4QkFBOEIsQ0FDeEQsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztZQUNELE9BQU87Z0JBQ0wsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2hDLENBQUM7WUFDRCxTQUFTO2dCQUNQLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNsQyxDQUFDO1lBQ0QsUUFBUSxDQUFzRDtZQUM5RCxVQUFVLENBQUMsT0FBZ0I7Z0JBQ3pCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDMUMsQ0FBQztZQUNELFVBQVU7Z0JBQ1IsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ25DLENBQUM7WUFDRCxRQUFRO2dCQUNOLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNqQyxDQUFDO1lBQ0QsUUFBUSxDQUFDLEtBQWE7Z0JBQ3BCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEMsQ0FBQztTQUNGO1FBakNZLGFBQU8sVUFpQ25CLENBQUE7UUFJRCxNQUFhLEdBQUc7WUFDRSxJQUFJLENBQVU7WUFDcEIsSUFBSSxDQUFvQjtZQUNsQyxPQUFPLENBQVc7WUFDbEIsWUFBWSxJQUFZLEVBQUUsT0FBa0I7Z0JBQzFDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztnQkFDdkIsS0FBSyxJQUFJLEdBQUcsSUFBSSxPQUFPLEVBQUU7b0JBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO2lCQUMvQjtZQUNILENBQUM7WUFDRCxJQUFJLFFBQVE7Z0JBQ1YsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztZQUMzQixDQUFDO1lBQ0QsSUFBVyxHQUFHO2dCQUNaLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSTtvQkFDZixJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ3ZDLEtBQUssQ0FBQyxVQUFVLENBQ2QsWUFBWSxJQUFJLENBQUMsSUFBSSw4QkFBOEIsQ0FDcEQsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztZQUNELGlCQUFpQixDQUFDLE9BQTJDO2dCQUMzRCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0MsQ0FBQztZQUNELGVBQWU7Z0JBQ2IsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3BDLENBQUM7WUFDRCxPQUFPO2dCQUNMLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUM1QixDQUFDO1lBQ0QsU0FBUztnQkFDUCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDOUIsQ0FBQztZQUNELG9CQUFvQixDQUFDLE9BQTJDO2dCQUM5RCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDaEQsQ0FBQztZQUNELGVBQWUsQ0FBQyxZQUE4QjtnQkFDNUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNoRCxDQUFDO1lBQ0QsVUFBVSxDQUFDLE9BQWdCO2dCQUN6QixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3RDLENBQUM7WUFDRCxVQUFVO2dCQUNSLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMvQixDQUFDO1lBQ0QsUUFBUTtnQkFDTixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDN0IsQ0FBQztZQUNELFFBQVEsQ0FBQyxLQUFhO2dCQUNwQixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxRQUFRO2dCQUNOLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM3QixDQUFDO1NBQ0Y7UUF0RFksU0FBRyxNQXNEZixDQUFBO1FBQ0QsTUFBYSxXQUFXO1lBQ04sSUFBSSxDQUFVO1lBQ3BCLFlBQVksQ0FBNEI7WUFDbEQsWUFBWSxJQUFZO2dCQUN0QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNuQixDQUFDO1lBQ0QsSUFBVyxXQUFXO2dCQUNwQixPQUFPLENBQ0wsQ0FBQyxJQUFJLENBQUMsWUFBWTtvQkFDaEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQTJCLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbkUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxhQUFhLElBQUksQ0FBQyxJQUFJLDhCQUE4QixDQUFDLENBQ3ZFLENBQUM7WUFDSixDQUFDO1lBQ0QsSUFBVyxJQUFJO2dCQUNiLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwQyxDQUFDO1lBQ0QsU0FBUyxDQUFDLE9BQWdEO2dCQUN4RCxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxPQUFjLENBQUMsQ0FBQztnQkFDOUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM3QyxDQUFDO1lBQ0QsY0FBYztnQkFDWixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDM0MsQ0FBQztZQUNELGFBQWE7Z0JBQ1gsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzFDLENBQUM7WUFDRCxXQUFXO2dCQUNULE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN4QyxDQUFDO1lBQ0QsT0FBTztnQkFDTCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEMsQ0FBQztZQUNELGVBQWU7Z0JBQ2IsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzVDLENBQUM7WUFDRCxNQUFNLENBQUMsTUFBMkI7Z0JBQ2hDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDekMsQ0FBQztZQUNELGVBQWU7Z0JBQ2IsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzVDLENBQUM7WUFDRCxlQUFlO2dCQUNiLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUM1QyxDQUFDO1lBQ0QsT0FBTztnQkFDTCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEMsQ0FBQztZQUNELGFBQWE7Z0JBQ1gsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzFDLENBQUM7WUFDRCxZQUFZLENBQUMsT0FBbUI7Z0JBQzlCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDaEQsQ0FBQztZQUNELGNBQWM7Z0JBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQzNDLENBQUM7WUFDRCxPQUFPO2dCQUNMLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwQyxDQUFDO1lBQ0QsU0FBUztnQkFDUCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDdEMsQ0FBQztZQUNELFFBQVE7Z0JBQ04sT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3JDLENBQUM7WUFDRCxRQUFRLENBQUMsS0FBYTtnQkFDcEIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxQyxDQUFDO1lBQ0QsVUFBVTtnQkFDUixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDdkMsQ0FBQztZQUNELFVBQVUsQ0FBQyxPQUFnQjtnQkFDekIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM5QyxDQUFDO1NBQ0Y7UUExRVksaUJBQVcsY0EwRXZCLENBQUE7SUFDSCxDQUFDLEVBeGdDZ0IsS0FBSyxHQUFMLFdBQUssS0FBTCxXQUFLLFFBd2dDckI7QUFDSCxDQUFDLEVBdCtEUyxLQUFLLEtBQUwsS0FBSyxRQXMrRGQiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vbm9kZV9tb2R1bGVzL0B0eXBlcy94cm0vaW5kZXguZC50c1wiIC8+XHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgcGFyYW1ldGVyIGZvciBhIHJlcXVlc3QuXHJcbiAqIEB0eXBlIHtPYmplY3R9IFJlcXVlc3RQYXJhbWV0ZXJcclxuICogQHByb3BlcnR5IHtzdHJpbmd9IE5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyLlxyXG4gKiBAcHJvcGVydHkgeydCb29sZWFuJyB8ICdEYXRlVGltZScgfCAnRGVjaW1hbCcgfCAnRW50aXR5JyB8ICdFbnRpdHlDb2xsZWN0aW9uJyB8ICdFbnRpdHlSZWZlcmVuY2UnIHwgJ0Zsb2F0JyB8ICdJbnRlZ2VyJyB8ICdNb25leScgfCAnUGlja2xpc3QnIHwgJ1N0cmluZyd9IFR5cGUgLSBUaGUgdHlwZSBvZiB0aGUgcGFyYW1ldGVyLlxyXG4gKiBAcHJvcGVydHkgeyp9IFZhbHVlIC0gVGhlIHZhbHVlIG9mIHRoZSBwYXJhbWV0ZXIuXHJcbiAqL1xyXG50eXBlIFJlcXVlc3RQYXJhbWV0ZXIgPSB7XHJcbiAgTmFtZTogc3RyaW5nO1xyXG4gIFR5cGU6XHJcbiAgICB8IFwiQm9vbGVhblwiXHJcbiAgICB8IFwiRGF0ZVRpbWVcIlxyXG4gICAgfCBcIkRlY2ltYWxcIlxyXG4gICAgfCBcIkVudGl0eVwiXHJcbiAgICB8IFwiRW50aXR5Q29sbGVjdGlvblwiXHJcbiAgICB8IFwiRW50aXR5UmVmZXJlbmNlXCJcclxuICAgIHwgXCJGbG9hdFwiXHJcbiAgICB8IFwiSW50ZWdlclwiXHJcbiAgICB8IFwiTW9uZXlcIlxyXG4gICAgfCBcIlBpY2tsaXN0XCJcclxuICAgIHwgXCJTdHJpbmdcIjtcclxuICBWYWx1ZTogYW55O1xyXG59O1xyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHJlZmVyZW5jZSB0byBhbiBlbnRpdHkuXHJcbiAqIEB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBpZCAtIFRoZSBJRCBvZiB0aGUgZW50aXR5LlxyXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZW50aXR5VHlwZSAtIFRoZSB0eXBlIG9mIHRoZSBlbnRpdHkuXHJcbiAqL1xyXG50eXBlIEVudGl0eVJlZmVyZW5jZSA9IHtcclxuICBpZDogc3RyaW5nO1xyXG4gIGVudGl0eVR5cGU6IHN0cmluZztcclxufTtcclxubmFtZXNwYWNlIFhybUV4IHtcclxuICAvKipcclxuICAgKiBUaHJvd3MgYW4gZXJyb3Igd2l0aCB0aGUgZ2l2ZW4gZXJyb3IgbWVzc2FnZS5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXJyb3JNZXNzYWdlIC0gVGhlIGVycm9yIG1lc3NhZ2UgdG8gdGhyb3cuXHJcbiAgICogQHRocm93cyB7RXJyb3J9IC0gQWx3YXlzIHRocm93cyBhbiBlcnJvciB3aXRoIHRoZSBnaXZlbiBlcnJvciBtZXNzYWdlLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBmdW5jdGlvbiB0aHJvd0Vycm9yKGVycm9yTWVzc2FnZTogc3RyaW5nKTogbmV2ZXIge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTWVzc2FnZSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgY3VycmVudCBzdGF0ZSBvZiBjbGllbnQgd2hldGhlciBpdCdzIG9ubGluZSBvciBvZmZsaW5lLiBUaGlzIG1ldGhvZFxyXG4gICAqIGlzIG9mIHF1c3Rpb25hYmxlIHVzZWZ1bG5lc3MgZm9yIGl0IHByb3ZpZGVzIGxpdHRsZSB0byBubyBiZW5lZml0IG92ZXIgdXNpbmdcclxuICAgKiB0aGUgbmF0aXZlIFhybSBTREsgbWV0aG9kLiBZb3UgZGVjaWRlLCBkZWFyIHByb2dyYW1tZXIhXHJcbiAgICogQHJldHVybnMgYm9vbGVhblxyXG4gICAqL1xyXG4gIGV4cG9ydCBmdW5jdGlvbiBpc09mZmxpbmUoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gWHJtLlV0aWxpdHkuZ2V0R2xvYmFsQ29udGV4dCgpLmNsaWVudC5pc09mZmxpbmUoKTtcclxuICB9XHJcbiAgLy8gLyoqXHJcbiAgLy8gICogUmV0dXJucyBuYXRpdmUgU0RLIFdlYkFwaSBhcHByb3ByaWF0ZSBmb3IgdGhlIGN1cnJlbnQgY2xpZW50IHN0YXRlXHJcbiAgLy8gICogQHJldHVybnMgWHJtLldlYkFwaU9mZmxpbmUgb3IgWHJtLldlYkFwaU9ubGluZVxyXG4gIC8vICAqL1xyXG4gIC8vIGZ1bmN0aW9uIGdldFhybVdlYkFwaSgpOiBYcm0uV2ViQXBpT2ZmbGluZSB8IFhybS5XZWJBcGlPbmxpbmUge1xyXG4gIC8vICAgaWYgKGlzT2ZmbGluZSgpID09PSB0cnVlKSB7XHJcbiAgLy8gICAgIHJldHVybiBYcm0uV2ViQXBpLm9mZmxpbmU7XHJcbiAgLy8gICB9IGVsc2Uge1xyXG4gIC8vICAgICByZXR1cm4gWHJtLldlYkFwaS5vbmxpbmU7XHJcbiAgLy8gICB9XHJcbiAgLy8gfVxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgdGhlIG5hbWUgb2YgdGhlIGNhbGxpbmcgZnVuY3Rpb24uXHJcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgbmFtZSBvZiB0aGUgY2FsbGluZyBmdW5jdGlvbi5cclxuICAgKi9cclxuICBleHBvcnQgZnVuY3Rpb24gZ2V0RnVuY3Rpb25OYW1lKCk6IHN0cmluZyB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcigpO1xyXG4gICAgICBjb25zdCBzdGFja1RyYWNlID0gZXJyb3Iuc3RhY2s/LnNwbGl0KFwiXFxuXCIpLm1hcCgobGluZSkgPT4gbGluZS50cmltKCkpO1xyXG4gICAgICBjb25zdCBjYWxsaW5nRnVuY3Rpb25MaW5lID1cclxuICAgICAgICBzdGFja1RyYWNlICYmIHN0YWNrVHJhY2UubGVuZ3RoID49IDMgPyBzdGFja1RyYWNlWzJdIDogdW5kZWZpbmVkO1xyXG4gICAgICBjb25zdCBmdW5jdGlvbk5hbWVNYXRjaCA9XHJcbiAgICAgICAgY2FsbGluZ0Z1bmN0aW9uTGluZT8ubWF0Y2goL2F0XFxzKyhbXlxcc10rKVxccytcXCgvKSB8fFxyXG4gICAgICAgIGNhbGxpbmdGdW5jdGlvbkxpbmU/Lm1hdGNoKC9hdFxccysoW15cXHNdKykvKTtcclxuICAgICAgY29uc3QgZnVuY3Rpb25OYW1lID0gZnVuY3Rpb25OYW1lTWF0Y2ggPyBmdW5jdGlvbk5hbWVNYXRjaFsxXSA6IFwiXCI7XHJcblxyXG4gICAgICByZXR1cm4gZnVuY3Rpb25OYW1lO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LmdldEZ1bmN0aW9uTmFtZTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIERpc3BsYXlzIGEgbm90aWZpY2F0aW9uIGZvciBhbiBhcHAgd2l0aCB0aGUgZ2l2ZW4gbWVzc2FnZSBhbmQgbGV2ZWwsIGFuZCBsZXRzIHlvdSBzcGVjaWZ5IHdoZXRoZXIgdG8gc2hvdyBhIGNsb3NlIGJ1dHRvbi5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIHRvIGRpc3BsYXkgaW4gdGhlIG5vdGlmaWNhdGlvbi5cclxuICAgKiBAcGFyYW0geydTVUNDRVNTJyB8ICdFUlJPUicgfCAnV0FSTklORycgfCAnSU5GTyd9IGxldmVsIC0gVGhlIGxldmVsIG9mIHRoZSBub3RpZmljYXRpb24uIENhbiBiZSAnU1VDQ0VTUycsICdFUlJPUicsICdXQVJOSU5HJywgb3IgJ0lORk8nLlxyXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3Nob3dDbG9zZUJ1dHRvbj1mYWxzZV0gLSBXaGV0aGVyIHRvIHNob3cgYSBjbG9zZSBidXR0b24gb24gdGhlIG5vdGlmaWNhdGlvbi4gRGVmYXVsdHMgdG8gZmFsc2UuXHJcbiAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn0gLSBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBJRCBvZiB0aGUgY3JlYXRlZCBub3RpZmljYXRpb24uXHJcbiAgICovXHJcbiAgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFkZEdsb2JhbE5vdGlmaWNhdGlvbihcclxuICAgIG1lc3NhZ2U6IHN0cmluZyxcclxuICAgIGxldmVsOiBcIlNVQ0NFU1NcIiB8IFwiRVJST1JcIiB8IFwiV0FSTklOR1wiIHwgXCJJTkZPXCIsXHJcbiAgICBzaG93Q2xvc2VCdXR0b24gPSBmYWxzZVxyXG4gICk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICBjb25zdCBsZXZlbE1hcCA9IHtcclxuICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgRVJST1I6IDIsXHJcbiAgICAgIFdBUk5JTkc6IDMsXHJcbiAgICAgIElORk86IDQsXHJcbiAgICB9O1xyXG4gICAgY29uc3QgbWVzc2FnZUxldmVsID0gbGV2ZWxNYXBbbGV2ZWxdIHx8IGxldmVsTWFwLklORk87XHJcbiAgICBjb25zdCBub3RpZmljYXRpb24gPSB7XHJcbiAgICAgIHR5cGU6IDIsXHJcbiAgICAgIGxldmVsOiBtZXNzYWdlTGV2ZWwsXHJcbiAgICAgIG1lc3NhZ2UsXHJcbiAgICAgIHNob3dDbG9zZUJ1dHRvbixcclxuICAgIH07XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gYXdhaXQgWHJtLkFwcC5hZGRHbG9iYWxOb3RpZmljYXRpb24obm90aWZpY2F0aW9uKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke2dldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIENsZWFycyBhIG5vdGlmaWNhdGlvbiBpbiB0aGUgYXBwIHdpdGggdGhlIGdpdmVuIHVuaXF1ZSBJRC5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gdW5pcXVlSWQgLSBUaGUgdW5pcXVlIElEIG9mIHRoZSBub3RpZmljYXRpb24gdG8gY2xlYXIuXHJcbiAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn0gLSBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBub3RpZmljYXRpb24gaGFzIGJlZW4gY2xlYXJlZC5cclxuICAgKi9cclxuICBleHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVtb3ZlR2xvYmFsTm90aWZpY2F0aW9uKFxyXG4gICAgdW5pcXVlSWQ6IHN0cmluZ1xyXG4gICk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gYXdhaXQgWHJtLkFwcC5jbGVhckdsb2JhbE5vdGlmaWNhdGlvbih1bmlxdWVJZCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtnZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfVxyXG4gIH1cclxuICAvKipcclxuICAgKiBSZXRyaWV2ZXMgdGhlIHZhbHVlIG9mIGFuIGVudmlyb25tZW50IHZhcmlhYmxlIGJ5IHVzaW5nIGl0cyBzY2hlbWEgbmFtZSBhcyBrZXkuXHJcbiAgICogSWYgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIGhhcyBib3RoIGEgZGVmYXVsdCB2YWx1ZSBhbmQgYSBjdXJyZW50IHZhbHVlLCB0aGlzIGZ1bmN0aW9uIHdpbGwgcmV0cmlldmUgdGhlIGN1cnJlbnQgdmFsdWUuXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IGVudmlyb25tZW50VmFyaWFibGVTY2hlbWFOYW1lIC0gVGhlIHNjaGVtYSBuYW1lIG9mIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSB0byByZXRyaWV2ZS5cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmc+fSAtIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIHZhbHVlIG9mIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZS5cclxuICAgKiBAYXN5bmNcclxuICAgKi9cclxuICBleHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RW52aXJvbm1lbnRWYXJpYWJsZVZhbHVlKFxyXG4gICAgZW52aXJvbm1lbnRWYXJpYWJsZVNjaGVtYU5hbWU6IHN0cmluZ1xyXG4gICk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCBleGVjdXRlRnVuY3Rpb24oXCJSZXRyaWV2ZUVudmlyb25tZW50VmFyaWFibGVWYWx1ZVwiLCBbXHJcbiAgICAgIHtcclxuICAgICAgICBOYW1lOiBcIkRlZmluaXRpb25TY2hlbWFOYW1lXCIsXHJcbiAgICAgICAgVHlwZTogXCJTdHJpbmdcIixcclxuICAgICAgICBWYWx1ZTogZW52aXJvbm1lbnRWYXJpYWJsZVNjaGVtYU5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICBdKTtcclxuICAgIHJldHVybiBPYmplY3QuaGFzT3duKHJlc3BvbnNlLCBcIlZhbHVlXCIpID8gcmVzcG9uc2UuVmFsdWUgOiByZXNwb25zZTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQSBtYXAgb2YgQ1JNIGRhdGEgdHlwZXMgdG8gdGhlaXIgY29ycmVzcG9uZGluZyB0eXBlIG5hbWVzLCBzdHJ1Y3R1cmFsIHByb3BlcnRpZXMsIGFuZCBKYXZhU2NyaXB0IHR5cGVzLlxyXG4gICAqIEB0eXBlIHtPYmplY3QuPHN0cmluZywgeyB0eXBlTmFtZTogc3RyaW5nLCBzdHJ1Y3R1cmFsUHJvcGVydHk6IG51bWJlciwganNUeXBlOiBzdHJpbmcgfT59XHJcbiAgICovXHJcbiAgbGV0IHR5cGVNYXAgPSB7XHJcbiAgICBTdHJpbmc6IHsgdHlwZU5hbWU6IFwiRWRtLlN0cmluZ1wiLCBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsIGpzVHlwZTogXCJzdHJpbmdcIiB9LFxyXG4gICAgSW50ZWdlcjogeyB0eXBlTmFtZTogXCJFZG0uSW50MzJcIiwgc3RydWN0dXJhbFByb3BlcnR5OiAxLCBqc1R5cGU6IFwibnVtYmVyXCIgfSxcclxuICAgIEJvb2xlYW46IHtcclxuICAgICAgdHlwZU5hbWU6IFwiRWRtLkJvb2xlYW5cIixcclxuICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiAxLFxyXG4gICAgICBqc1R5cGU6IFwiYm9vbGVhblwiLFxyXG4gICAgfSxcclxuICAgIERhdGVUaW1lOiB7XHJcbiAgICAgIHR5cGVOYW1lOiBcIkVkbS5EYXRlVGltZU9mZnNldFwiLFxyXG4gICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsXHJcbiAgICAgIGpzVHlwZTogXCJvYmplY3RcIixcclxuICAgIH0sXHJcbiAgICBFbnRpdHlSZWZlcmVuY2U6IHtcclxuICAgICAgdHlwZU5hbWU6IFwibXNjcm0uY3JtYmFzZWVudGl0eVwiLFxyXG4gICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IDUsXHJcbiAgICAgIGpzVHlwZTogXCJvYmplY3RcIixcclxuICAgIH0sXHJcbiAgICBEZWNpbWFsOiB7XHJcbiAgICAgIHR5cGVOYW1lOiBcIkVkbS5EZWNpbWFsXCIsXHJcbiAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSxcclxuICAgICAganNUeXBlOiBcIm51bWJlclwiLFxyXG4gICAgfSxcclxuICAgIEVudGl0eToge1xyXG4gICAgICB0eXBlTmFtZTogXCJtc2NybS5jcm1iYXNlZW50aXR5XCIsXHJcbiAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogNSxcclxuICAgICAganNUeXBlOiBcIm9iamVjdFwiLFxyXG4gICAgfSxcclxuICAgIEVudGl0eUNvbGxlY3Rpb246IHtcclxuICAgICAgdHlwZU5hbWU6IFwiQ29sbGVjdGlvbihtc2NybS5jcm1iYXNlZW50aXR5KVwiLFxyXG4gICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IDQsXHJcbiAgICAgIGpzVHlwZTogXCJvYmplY3RcIixcclxuICAgIH0sXHJcbiAgICBGbG9hdDogeyB0eXBlTmFtZTogXCJFZG0uRG91YmxlXCIsIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSwganNUeXBlOiBcIm51bWJlclwiIH0sXHJcbiAgICBNb25leTogeyB0eXBlTmFtZTogXCJFZG0uRGVjaW1hbFwiLCBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsIGpzVHlwZTogXCJudW1iZXJcIiB9LFxyXG4gICAgUGlja2xpc3Q6IHtcclxuICAgICAgdHlwZU5hbWU6IFwiRWRtLkludDMyXCIsXHJcbiAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSxcclxuICAgICAganNUeXBlOiBcIm51bWJlclwiLFxyXG4gICAgfSxcclxuICB9O1xyXG4gIC8qKlxyXG4gICAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gcmVxdWVzdCBwYXJhbWV0ZXIgaXMgb2YgYSBzdXBwb3J0ZWQgdHlwZSBhbmQgaGFzIGEgdmFsaWQgdmFsdWUuXHJcbiAgICogQHBhcmFtIHtSZXF1ZXN0UGFyYW1ldGVyfSByZXF1ZXN0UGFyYW1ldGVyIC0gVGhlIHJlcXVlc3QgcGFyYW1ldGVyIHRvIGNoZWNrLlxyXG4gICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAqIEB0aHJvd3Mge0Vycm9yfSAtIFRocm93cyBhbiBlcnJvciBpZiB0aGUgcmVxdWVzdCBwYXJhbWV0ZXIgaXMgbm90IG9mIGEgc3VwcG9ydGVkIHR5cGUgb3IgaGFzIGFuIGludmFsaWQgdmFsdWUuXHJcbiAgICovXHJcbiAgZXhwb3J0IGZ1bmN0aW9uIGNoZWNrUmVxdWVzdFBhcmFtZXRlclR5cGUoXHJcbiAgICByZXF1ZXN0UGFyYW1ldGVyOiBSZXF1ZXN0UGFyYW1ldGVyXHJcbiAgKTogdm9pZCB7XHJcbiAgICBpZiAoIXR5cGVNYXBbcmVxdWVzdFBhcmFtZXRlci5UeXBlXSlcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgIGBUaGUgcHJvcGVydHkgdHlwZSAke3JlcXVlc3RQYXJhbWV0ZXIuVHlwZX0gb2YgdGhlIHByb3BlcnR5ICR7cmVxdWVzdFBhcmFtZXRlci5OYW1lfSBpcyBub3Qgc3VwcG9ydGVkLmBcclxuICAgICAgKTtcclxuICAgIGNvbnN0IGV4cGVjdGVkVHlwZSA9IHR5cGVNYXBbcmVxdWVzdFBhcmFtZXRlci5UeXBlXS5qc1R5cGU7XHJcbiAgICBjb25zdCBhY3R1YWxUeXBlID0gdHlwZW9mIHJlcXVlc3RQYXJhbWV0ZXIuVmFsdWU7XHJcbiAgICBjb25zdCBpbnZhbGlkVHlwZU1lc3NhZ2UgPSBgVGhlIHZhbHVlICR7cmVxdWVzdFBhcmFtZXRlci5WYWx1ZX1cXG5vZiB0aGUgcHJvcGVydHkgJHtyZXF1ZXN0UGFyYW1ldGVyLk5hbWV9XFxuaXMgbm90IG9mIHRoZSBleHBlY3RlZCB0eXBlICR7cmVxdWVzdFBhcmFtZXRlci5UeXBlfS5gO1xyXG4gICAgaWYgKFxyXG4gICAgICByZXF1ZXN0UGFyYW1ldGVyLlR5cGUgPT09IFwiRW50aXR5UmVmZXJlbmNlXCIgfHxcclxuICAgICAgcmVxdWVzdFBhcmFtZXRlci5UeXBlID09PSBcIkVudGl0eVwiXHJcbiAgICApIHtcclxuICAgICAgaWYgKFxyXG4gICAgICAgICFyZXF1ZXN0UGFyYW1ldGVyLlZhbHVlIHx8XHJcbiAgICAgICAgIXJlcXVlc3RQYXJhbWV0ZXIuVmFsdWUuaGFzT3duUHJvcGVydHkoXCJpZFwiKSB8fFxyXG4gICAgICAgICFyZXF1ZXN0UGFyYW1ldGVyLlZhbHVlLmhhc093blByb3BlcnR5KFwiZW50aXR5VHlwZVwiKVxyXG4gICAgICApIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoaW52YWxpZFR5cGVNZXNzYWdlKTtcclxuICAgICAgfVxyXG4gICAgICB0eXBlTWFwW1xyXG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXIuVHlwZVxyXG4gICAgICBdLnR5cGVOYW1lID0gYG1zY3JtLiR7cmVxdWVzdFBhcmFtZXRlci5WYWx1ZS5lbnRpdHlUeXBlfWA7XHJcbiAgICB9IGVsc2UgaWYgKHJlcXVlc3RQYXJhbWV0ZXIuVHlwZSA9PT0gXCJFbnRpdHlDb2xsZWN0aW9uXCIpIHtcclxuICAgICAgaWYgKFxyXG4gICAgICAgICFBcnJheS5pc0FycmF5KHJlcXVlc3RQYXJhbWV0ZXIuVmFsdWUpIHx8XHJcbiAgICAgICAgcmVxdWVzdFBhcmFtZXRlci5WYWx1ZS5ldmVyeShcclxuICAgICAgICAgICh2KSA9PlxyXG4gICAgICAgICAgICB0eXBlb2YgdiAhPT0gXCJvYmplY3RcIiB8fFxyXG4gICAgICAgICAgICAhdiB8fFxyXG4gICAgICAgICAgICAhdi5oYXNPd25Qcm9wZXJ0eShcImlkXCIpIHx8XHJcbiAgICAgICAgICAgICF2Lmhhc093blByb3BlcnR5KFwiZW50aXR5VHlwZVwiKVxyXG4gICAgICAgIClcclxuICAgICAgKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGludmFsaWRUeXBlTWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAocmVxdWVzdFBhcmFtZXRlci5UeXBlID09PSBcIkRhdGVUaW1lXCIpIHtcclxuICAgICAgaWYgKCEocmVxdWVzdFBhcmFtZXRlci5WYWx1ZSBpbnN0YW5jZW9mIERhdGUpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGludmFsaWRUeXBlTWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmIChhY3R1YWxUeXBlICE9PSBleHBlY3RlZFR5cGUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoaW52YWxpZFR5cGVNZXNzYWdlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICAvKipcclxuICAgKiBFeGVjdXRlcyBhbiBBY3Rpb24uXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbk5hbWUgLSBUaGUgdW5pcXVlIG5hbWUgb2YgdGhlIGFjdGlvbi5cclxuICAgKiBAcGFyYW0ge1JlcXVlc3RQYXJhbWV0ZXJbXX0gcmVxdWVzdFBhcmFtZXRlcnMgLSBBbiBhcnJheSBvZiBvYmplY3RzIHdpdGggdGhlIHBhcmFtZXRlciBuYW1lLCB0eXBlIGFuZCB2YWx1ZS5cclxuICAgKiBAcGFyYW0ge0VudGl0eVJlZmVyZW5jZX0gW2JvdW5kRW50aXR5XSAtIEFuIG9wdGlvbmFsIEVudGl0eVJlZmVyZW5jZSBvZiB0aGUgYm91bmQgZW50aXR5LlxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPGFueT59IC0gQSBQcm9taXNlIHdpdGggdGhlIHJlcXVlc3QgcmVzcG9uc2UuXHJcbiAgICogQHRocm93cyB7RXJyb3J9IC0gVGhyb3dzIGFuIGVycm9yIGlmIHRoZSByZXF1ZXN0IHBhcmFtZXRlciBpcyBub3Qgb2YgYSBzdXBwb3J0ZWQgdHlwZSBvciBoYXMgYW4gaW52YWxpZCB2YWx1ZS5cclxuICAgKi9cclxuICBleHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZUFjdGlvbihcclxuICAgIGFjdGlvbk5hbWU6IHN0cmluZyxcclxuICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiBSZXF1ZXN0UGFyYW1ldGVyW10sXHJcbiAgICBib3VuZEVudGl0eT86IEVudGl0eVJlZmVyZW5jZVxyXG4gICk6IFByb21pc2U8YW55PiB7XHJcbiAgICBjb25zdCBwYXJhbWV0ZXJEZWZpbml0aW9uOiBhbnkgPSB7fTtcclxuICAgIGlmIChib3VuZEVudGl0eSlcclxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnMucHVzaCh7XHJcbiAgICAgICAgTmFtZTogXCJlbnRpdHlcIixcclxuICAgICAgICBWYWx1ZTogYm91bmRFbnRpdHksXHJcbiAgICAgICAgVHlwZTogXCJFbnRpdHlSZWZlcmVuY2VcIixcclxuICAgICAgfSk7XHJcbiAgICBmb3IgKGNvbnN0IHJlcXVlc3RQYXJhbWV0ZXIgb2YgcmVxdWVzdFBhcmFtZXRlcnMpIHtcclxuICAgICAgY2hlY2tSZXF1ZXN0UGFyYW1ldGVyVHlwZShyZXF1ZXN0UGFyYW1ldGVyKTtcclxuICAgICAgcGFyYW1ldGVyRGVmaW5pdGlvbltyZXF1ZXN0UGFyYW1ldGVyLk5hbWVdID0ge1xyXG4gICAgICAgIHR5cGVOYW1lOiB0eXBlTWFwW3JlcXVlc3RQYXJhbWV0ZXIuVHlwZV0udHlwZU5hbWUsXHJcbiAgICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiB0eXBlTWFwW3JlcXVlc3RQYXJhbWV0ZXIuVHlwZV0uc3RydWN0dXJhbFByb3BlcnR5LFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG4gICAgY29uc3QgcmVxID0gT2JqZWN0LmFzc2lnbihcclxuICAgICAge1xyXG4gICAgICAgIGdldE1ldGFkYXRhOiAoKSA9PiAoe1xyXG4gICAgICAgICAgYm91bmRQYXJhbWV0ZXI6IGJvdW5kRW50aXR5ID8gXCJlbnRpdHlcIiA6IG51bGwsXHJcbiAgICAgICAgICBvcGVyYXRpb25UeXBlOiAwLFxyXG4gICAgICAgICAgb3BlcmF0aW9uTmFtZTogYWN0aW9uTmFtZSxcclxuICAgICAgICAgIHBhcmFtZXRlclR5cGVzOiBwYXJhbWV0ZXJEZWZpbml0aW9uLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICB9LFxyXG4gICAgICAuLi5yZXF1ZXN0UGFyYW1ldGVycy5tYXAoKHApID0+ICh7IFtwLk5hbWVdOiBwLlZhbHVlIH0pKVxyXG4gICAgKTtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgWHJtLldlYkFwaS5vbmxpbmUuZXhlY3V0ZShyZXEpO1xyXG4gICAgaWYgKHJlc3BvbnNlLm9rKSByZXR1cm4gcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+IHJlc3BvbnNlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEV4ZWN1dGVzIGEgRnVuY3Rpb24uXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZ1bmN0aW9uTmFtZSAtIFRoZSB1bmlxdWUgbmFtZSBvZiB0aGUgZnVuY3Rpb24uXHJcbiAgICogQHBhcmFtIHtSZXF1ZXN0UGFyYW1ldGVyW119IHJlcXVlc3RQYXJhbWV0ZXJzIC0gQW4gYXJyYXkgb2Ygb2JqZWN0cyB3aXRoIHRoZSBwYXJhbWV0ZXIgbmFtZSwgdHlwZSBhbmQgdmFsdWUuXHJcbiAgICogQHBhcmFtIHtFbnRpdHlSZWZlcmVuY2V9IFtib3VuZEVudGl0eV0gLSBBbiBvcHRpb25hbCBFbnRpdHlSZWZlcmVuY2Ugb2YgdGhlIGJvdW5kIGVudGl0eS5cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxhbnk+fSAtIEEgUHJvbWlzZSB3aXRoIHRoZSByZXF1ZXN0IHJlc3BvbnNlLlxyXG4gICAqIEB0aHJvd3Mge0Vycm9yfSAtIFRocm93cyBhbiBlcnJvciBpZiB0aGUgcmVxdWVzdCBwYXJhbWV0ZXIgaXMgbm90IG9mIGEgc3VwcG9ydGVkIHR5cGUgb3IgaGFzIGFuIGludmFsaWQgdmFsdWUuXHJcbiAgICovXHJcbiAgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGVGdW5jdGlvbihcclxuICAgIGZ1bmN0aW9uTmFtZTogc3RyaW5nLFxyXG4gICAgcmVxdWVzdFBhcmFtZXRlcnM6IFJlcXVlc3RQYXJhbWV0ZXJbXSxcclxuICAgIGJvdW5kRW50aXR5PzogRW50aXR5UmVmZXJlbmNlXHJcbiAgKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIGNvbnN0IHBhcmFtZXRlckRlZmluaXRpb246IGFueSA9IHt9O1xyXG4gICAgaWYgKGJvdW5kRW50aXR5KVxyXG4gICAgICByZXF1ZXN0UGFyYW1ldGVycy5wdXNoKHtcclxuICAgICAgICBOYW1lOiBcImVudGl0eVwiLFxyXG4gICAgICAgIFZhbHVlOiBib3VuZEVudGl0eSxcclxuICAgICAgICBUeXBlOiBcIkVudGl0eVJlZmVyZW5jZVwiLFxyXG4gICAgICB9KTtcclxuICAgIGZvciAoY29uc3QgcmVxdWVzdFBhcmFtZXRlciBvZiByZXF1ZXN0UGFyYW1ldGVycykge1xyXG4gICAgICBjaGVja1JlcXVlc3RQYXJhbWV0ZXJUeXBlKHJlcXVlc3RQYXJhbWV0ZXIpO1xyXG4gICAgICBwYXJhbWV0ZXJEZWZpbml0aW9uW3JlcXVlc3RQYXJhbWV0ZXIuTmFtZV0gPSB7XHJcbiAgICAgICAgdHlwZU5hbWU6IHR5cGVNYXBbcmVxdWVzdFBhcmFtZXRlci5UeXBlXS50eXBlTmFtZSxcclxuICAgICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IHR5cGVNYXBbcmVxdWVzdFBhcmFtZXRlci5UeXBlXS5zdHJ1Y3R1cmFsUHJvcGVydHksXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICBjb25zdCByZXEgPSBPYmplY3QuYXNzaWduKFxyXG4gICAgICB7XHJcbiAgICAgICAgZ2V0TWV0YWRhdGE6ICgpID0+ICh7XHJcbiAgICAgICAgICBib3VuZFBhcmFtZXRlcjogYm91bmRFbnRpdHkgPyBcImVudGl0eVwiIDogbnVsbCxcclxuICAgICAgICAgIG9wZXJhdGlvblR5cGU6IDEsXHJcbiAgICAgICAgICBvcGVyYXRpb25OYW1lOiBmdW5jdGlvbk5hbWUsXHJcbiAgICAgICAgICBwYXJhbWV0ZXJUeXBlczogcGFyYW1ldGVyRGVmaW5pdGlvbixcclxuICAgICAgICB9KSxcclxuICAgICAgfSxcclxuICAgICAgLi4ucmVxdWVzdFBhcmFtZXRlcnMubWFwKChwKSA9PiAoeyBbcC5OYW1lXTogcC5WYWx1ZSB9KSlcclxuICAgICk7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IFhybS5XZWJBcGkub25saW5lLmV4ZWN1dGUocmVxKTtcclxuICAgIGlmIChyZXNwb25zZS5vaykgcmV0dXJuIHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiByZXNwb25zZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlcyBhIEdVSUQgbG93ZXJjYXNlIGFuZCByZW1vdmVzIGJyYWNrZXRzLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBndWlkIC0gVGhlIEdVSUQgdG8gbm9ybWFsaXplLlxyXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIG5vcm1hbGl6ZWQgR1VJRC5cclxuICAgKi9cclxuICBleHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplR3VpZChndWlkOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKHR5cGVvZiBndWlkICE9PSBcInN0cmluZ1wiKVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4Lm5vcm1hbGl6ZUd1aWQ6XFxuJyR7Z3VpZH0nIGlzIG5vdCBhIHN0cmluZ2ApO1xyXG4gICAgcmV0dXJuIGd1aWQudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9be31dL2csIFwiXCIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogV3JhcHMgYSBmdW5jdGlvbiB0aGF0IHRha2VzIGEgY2FsbGJhY2sgYXMgaXRzIGxhc3QgcGFyYW1ldGVyIGFuZCByZXR1cm5zIGEgUHJvbWlzZS5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiB0aGUgZnVuY3Rpb24gdG8gd3JhcFxyXG4gICAqIEBwYXJhbSBjb250ZXh0IHRoZSBwYXJlbnQgcHJvcGVydHkgb2YgdGhlIGZ1bmN0aW9uIGYuZS4gZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzIGZvciBmb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuZ2V0RW5hYmxlZFByb2Nlc3Nlc1xyXG4gICAqIEBwYXJhbSBhcmdzIHRoZSBhcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgZnVuY3Rpb25cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxhbnk+fSBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBjYWxsYmFjayByZXNwb25zZVxyXG4gICAqL1xyXG4gIGV4cG9ydCBmdW5jdGlvbiBhc1Byb21pc2U8VD4oZm46IEZ1bmN0aW9uLCBjb250ZXh0LCAuLi5hcmdzKTogUHJvbWlzZTxUPiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBjYWxsYmFjayA9IChyZXNwb25zZTogVCkgPT4ge1xyXG4gICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xyXG4gICAgICB9O1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIC8vIENhbGwgdGhlIGZ1bmN0aW9uIHdpdGggdGhlIGFyZ3VtZW50cyBhbmQgdGhlIGNhbGxiYWNrIGF0IHRoZSBlbmRcclxuICAgICAgICBmbi5jYWxsKGNvbnRleHQsIC4uLmFyZ3MsIGNhbGxiYWNrKTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogT3BlbnMgYSBkaWFsb2cgd2l0aCBkeW5hbWljIGhlaWdodCBhbmQgd2lkdGggYmFzZWQgb24gdGV4dCBjb250ZW50LlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0aXRsZSAtIFRoZSB0aXRsZSBvZiB0aGUgZGlhbG9nLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gVGhlIHRleHQgY29udGVudCBvZiB0aGUgZGlhbG9nLlxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPGFueT59IC0gQSBQcm9taXNlIHdpdGggdGhlIGRpYWxvZyByZXNwb25zZS5cclxuICAgKi9cclxuICBleHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlbkFsZXJ0RGlhbG9nKFxyXG4gICAgdGl0bGU6IHN0cmluZyxcclxuICAgIHRleHQ6IHN0cmluZ1xyXG4gICk6IFByb21pc2U8YW55PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByb3dzID0gdGV4dC5zcGxpdCgvXFxyXFxufFxccnxcXG4vKTtcclxuICAgICAgbGV0IGFkZGl0aW9uYWxSb3dzID0gMDtcclxuICAgICAgcm93cy5mb3JFYWNoKChyb3cpID0+IHtcclxuICAgICAgICBsZXQgd2lkdGggPSBnZXRUZXh0V2lkdGgoXHJcbiAgICAgICAgICByb3csXHJcbiAgICAgICAgICBcIjFyZW0gU2Vnb2UgVUkgUmVndWxhciwgU2Vnb2VVSSwgU2Vnb2UgVUlcIlxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKHdpZHRoID4gOTQwKSB7XHJcbiAgICAgICAgICBhZGRpdGlvbmFsUm93cyArPSB3aWR0aCAvIDk0MDtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICBjb25zdCBsb25nZXN0Um93ID0gcm93cy5yZWR1Y2UoXHJcbiAgICAgICAgKGFjYywgcm93KSA9PiAocm93Lmxlbmd0aCA+IGFjYy5sZW5ndGggPyByb3cgOiBhY2MpLFxyXG4gICAgICAgIFwiXCJcclxuICAgICAgKTtcclxuICAgICAgY29uc3Qgd2lkdGggPSBNYXRoLm1pbihcclxuICAgICAgICBnZXRUZXh0V2lkdGgobG9uZ2VzdFJvdywgXCIxcmVtIFNlZ29lIFVJIFJlZ3VsYXIsIFNlZ29lVUksIFNlZ29lIFVJXCIpLFxyXG4gICAgICAgIDEwMDBcclxuICAgICAgKTtcclxuICAgICAgY29uc3QgaGVpZ2h0ID0gMTA5ICsgKHJvd3MubGVuZ3RoICsgYWRkaXRpb25hbFJvd3MpICogMjA7XHJcbiAgICAgIHJldHVybiBhd2FpdCBYcm0uTmF2aWdhdGlvbi5vcGVuQWxlcnREaWFsb2coXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgY29uZmlybUJ1dHRvbkxhYmVsOiBcIk9rXCIsXHJcbiAgICAgICAgICB0ZXh0LFxyXG4gICAgICAgICAgdGl0bGUsXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBoZWlnaHQsXHJcbiAgICAgICAgICB3aWR0aCxcclxuICAgICAgICB9XHJcbiAgICAgICk7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IubWVzc2FnZSk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtnZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2VzIGNhbnZhcy5tZWFzdXJlVGV4dCB0byBjb21wdXRlIGFuZCByZXR1cm4gdGhlIHdpZHRoIG9mIHRoZSBnaXZlbiB0ZXh0IG9mIGdpdmVuIGZvbnQgaW4gcGl4ZWxzLlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0IFRoZSB0ZXh0IHRvIGJlIHJlbmRlcmVkLlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGZvbnQgVGhlIGNzcyBmb250IGRlc2NyaXB0b3IgdGhhdCB0ZXh0IGlzIHRvIGJlIHJlbmRlcmVkIHdpdGggKGUuZy4gXCJib2xkIDE0cHggdmVyZGFuYVwiKS5cclxuICAgICAqXHJcbiAgICAgKiBAc2VlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzExODI0MS9jYWxjdWxhdGUtdGV4dC13aWR0aC13aXRoLWphdmFzY3JpcHQvMjEwMTUzOTMjMjEwMTUzOTNcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZ2V0VGV4dFdpZHRoKHRleHQ6IHN0cmluZywgZm9udDogc3RyaW5nKSB7XHJcbiAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG4gICAgICBjb250ZXh0LmZvbnQgPSBmb250O1xyXG4gICAgICBjb25zdCBtZXRyaWNzID0gY29udGV4dC5tZWFzdXJlVGV4dCh0ZXh0KTtcclxuICAgICAgcmV0dXJuIG1ldHJpY3Mud2lkdGg7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBleHBvcnQgY2xhc3MgUHJvY2VzcyB7XHJcbiAgICBzdGF0aWMgZ2V0IGRhdGEoKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2VzcztcclxuICAgIH1cclxuICAgIHN0YXRpYyBnZXQgdWkoKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LnVpLnByb2Nlc3M7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIGFkZCBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UgZXZlbnQgc28gdGhhdCBpdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgdGhlXHJcbiAgICAgKiBidXNpbmVzcyBwcm9jZXNzIGZsb3cgc3RhdHVzIGNoYW5nZXMuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gd2lsbCBiZSBhZGRlZCB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudFxyXG4gICAgICogICAgICAgICAgICAgICAgaGFuZGxlciBwaXBlbGluZS4gVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGlzIGF1dG9tYXRpY2FsbHlcclxuICAgICAqICAgICAgICAgICAgICAgIHNldCB0byBiZSB0aGUgZmlyc3QgcGFyYW1ldGVyIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cclxuICAgICAqICAgICAgICAgICAgICAgIFVzZSBhIHJlZmVyZW5jZSB0byBhIG5hbWVkIGZ1bmN0aW9uIHJhdGhlciB0aGFuIGFuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBhbm9ueW1vdXMgZnVuY3Rpb24gaWYgeW91IG1heSBsYXRlciB3YW50IHRvIHJlbW92ZSB0aGVcclxuICAgICAqICAgICAgICAgICAgICAgIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UoXHJcbiAgICAgIGhhbmRsZXI6IFhybS5FdmVudHMuUHJvY2Vzc1N0YXR1c0NoYW5nZUhhbmRsZXJcclxuICAgICkge1xyXG4gICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5hZGRPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIGFkZCBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblByZVN0YWdlQ2hhbmdlIGV2ZW50IHNvIHRoYXQgaXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIHRoZVxyXG4gICAgICogYnVzaW5lc3MgcHJvY2VzcyBmbG93IHN0YWdlIGNoYW5nZXMuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gd2lsbCBiZSBhZGRlZCB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudFxyXG4gICAgICogICAgICAgICAgICAgICAgaGFuZGxlciBwaXBlbGluZS4gVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGlzIGF1dG9tYXRpY2FsbHlcclxuICAgICAqICAgICAgICAgICAgICAgIHNldCB0byBiZSB0aGUgZmlyc3QgcGFyYW1ldGVyIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cclxuICAgICAqICAgICAgICAgICAgICAgIFVzZSBhIHJlZmVyZW5jZSB0byBhIG5hbWVkIGZ1bmN0aW9uIHJhdGhlciB0aGFuIGFuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBhbm9ueW1vdXMgZnVuY3Rpb24gaWYgeW91IG1heSBsYXRlciB3YW50IHRvIHJlbW92ZSB0aGVcclxuICAgICAqICAgICAgICAgICAgICAgIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPblByZVN0YWdlQ2hhbmdlKGhhbmRsZXI6IFhybS5FdmVudHMuU3RhZ2VDaGFuZ2VFdmVudEhhbmRsZXIpIHtcclxuICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25QcmVTdGFnZUNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmFkZE9uUHJlU3RhZ2VDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIGFkZCBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UgZXZlbnQgc28gdGhhdCBpdCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZVxyXG4gICAgICogYnVzaW5lc3MgcHJvY2VzcyBmbG93IHN0YXR1cyBjaGFuZ2VzLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnRcclxuICAgICAqICAgICAgICAgICAgICAgIGhhbmRsZXIgcGlwZWxpbmUuIFRoZSBleGVjdXRpb24gY29udGV4dCBpcyBhdXRvbWF0aWNhbGx5XHJcbiAgICAgKiAgICAgICAgICAgICAgICBzZXQgdG8gYmUgdGhlIGZpcnN0IHBhcmFtZXRlciBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBVc2UgYSByZWZlcmVuY2UgdG8gYSBuYW1lZCBmdW5jdGlvbiByYXRoZXIgdGhhbiBhblxyXG4gICAgICogICAgICAgICAgICAgICAgYW5vbnltb3VzIGZ1bmN0aW9uIGlmIHlvdSBtYXkgbGF0ZXIgd2FudCB0byByZW1vdmUgdGhlXHJcbiAgICAgKiAgICAgICAgICAgICAgICBldmVudCBoYW5kbGVyLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25Qcm9jZXNzU3RhdHVzQ2hhbmdlKFxyXG4gICAgICBoYW5kbGVyOiBYcm0uRXZlbnRzLlByb2Nlc3NTdGF0dXNDaGFuZ2VIYW5kbGVyXHJcbiAgICApIHtcclxuICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25Qcm9jZXNzU3RhdHVzQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuYWRkT25Qcm9jZXNzU3RhdHVzQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byBhZGQgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25TdGFnZUNoYW5nZSBldmVudCBzbyB0aGF0IGl0IHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlXHJcbiAgICAgKiBidXNpbmVzcyBwcm9jZXNzIGZsb3cgc3RhZ2UgY2hhbmdlcy5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGFkZGVkIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50XHJcbiAgICAgKiAgICAgICAgICAgICAgICBoYW5kbGVyIHBpcGVsaW5lLiBUaGUgZXhlY3V0aW9uIGNvbnRleHQgaXMgYXV0b21hdGljYWxseVxyXG4gICAgICogICAgICAgICAgICAgICAgc2V0IHRvIGJlIHRoZSBmaXJzdCBwYXJhbWV0ZXIgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxyXG4gICAgICogICAgICAgICAgICAgICAgVXNlIGEgcmVmZXJlbmNlIHRvIGEgbmFtZWQgZnVuY3Rpb24gcmF0aGVyIHRoYW4gYW5cclxuICAgICAqICAgICAgICAgICAgICAgIGFub255bW91cyBmdW5jdGlvbiBpZiB5b3UgbWF5IGxhdGVyIHdhbnQgdG8gcmVtb3ZlIHRoZVxyXG4gICAgICogICAgICAgICAgICAgICAgZXZlbnQgaGFuZGxlci5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uU3RhZ2VDaGFuZ2UoaGFuZGxlcjogWHJtLkV2ZW50cy5TdGFnZUNoYW5nZUV2ZW50SGFuZGxlcikge1xyXG4gICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblN0YWdlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuYWRkT25TdGFnZUNoYW5nZShoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gYWRkIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uU3RhZ2VTZWxlY3RlZCBldmVudCBzbyB0aGF0IGl0IHdpbGwgYmUgY2FsbGVkXHJcbiAgICAgKiB3aGVuIGEgYnVzaW5lc3MgcHJvY2VzcyBmbG93IHN0YWdlIGlzIHNlbGVjdGVkLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnRcclxuICAgICAqICAgICAgICAgICAgICAgIGhhbmRsZXIgcGlwZWxpbmUuIFRoZSBleGVjdXRpb24gY29udGV4dCBpcyBhdXRvbWF0aWNhbGx5XHJcbiAgICAgKiAgICAgICAgICAgICAgICBzZXQgdG8gYmUgdGhlIGZpcnN0IHBhcmFtZXRlciBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBVc2UgYSByZWZlcmVuY2UgdG8gYSBuYW1lZCBmdW5jdGlvbiByYXRoZXIgdGhhbiBhblxyXG4gICAgICogICAgICAgICAgICAgICAgYW5vbnltb3VzIGZ1bmN0aW9uIGlmIHlvdSBtYXkgbGF0ZXIgd2FudCB0byByZW1vdmUgdGhlXHJcbiAgICAgKiAgICAgICAgICAgICAgICBldmVudCBoYW5kbGVyLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25TdGFnZVNlbGVjdGVkKGhhbmRsZXI6IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXIpIHtcclxuICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25TdGFnZVNlbGVjdGVkKGhhbmRsZXIpO1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuYWRkT25TdGFnZVNlbGVjdGVkKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byByZW1vdmUgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlIGV2ZW50LlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgSWYgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIGlzIHNldCB1c2luZyB0aGUgYWRkT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlIG1ldGhvZCBpdFxyXG4gICAgICogICAgICAgICAgICAgICAgY2Fubm90IGJlIHJlbW92ZWQgdXNpbmcgdGhpcyBtZXRob2QuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UoXHJcbiAgICAgIGhhbmRsZXI6IFhybS5FdmVudHMuUHJvY2Vzc1N0YXR1c0NoYW5nZUhhbmRsZXJcclxuICAgICkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlKFxyXG4gICAgICAgIGhhbmRsZXJcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gcmVtb3ZlIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uUHJlU3RhZ2VDaGFuZ2UgZXZlbnQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBJZiBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgc2V0IHVzaW5nIHRoZSBhZGRPblByZVN0YWdlQ2hhbmdlIG1ldGhvZCBpdFxyXG4gICAgICogICAgICAgICAgICAgICAgY2Fubm90IGJlIHJlbW92ZWQgdXNpbmcgdGhpcyBtZXRob2QuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVPblByZVN0YWdlQ2hhbmdlKGhhbmRsZXI6IFhybS5FdmVudHMuU3RhZ2VDaGFuZ2VFdmVudEhhbmRsZXIpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uUHJlU3RhZ2VDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIHJlbW92ZSBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblByb2Nlc3NTdGF0dXNDaGFuZ2UgZXZlbnQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBJZiBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgc2V0IHVzaW5nIHRoZSBhZGRPblByb2Nlc3NTdGF0dXNDaGFuZ2UgbWV0aG9kIGl0XHJcbiAgICAgKiAgICAgICAgICAgICAgICBjYW5ub3QgYmUgcmVtb3ZlZCB1c2luZyB0aGlzIG1ldGhvZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZU9uUHJvY2Vzc1N0YXR1c0NoYW5nZShcclxuICAgICAgaGFuZGxlcjogWHJtLkV2ZW50cy5Qcm9jZXNzU3RhdHVzQ2hhbmdlSGFuZGxlclxyXG4gICAgKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblByb2Nlc3NTdGF0dXNDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIHJlbW92ZSBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblN0YWdlQ2hhbmdlIGV2ZW50LlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgSWYgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIGlzIHNldCB1c2luZyB0aGUgYWRkT25TdGFnZUNoYW5nZSBtZXRob2QgaXRcclxuICAgICAqICAgICAgICAgICAgICAgIGNhbm5vdCBiZSByZW1vdmVkIHVzaW5nIHRoaXMgbWV0aG9kLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlT25TdGFnZUNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLlN0YWdlQ2hhbmdlRXZlbnRIYW5kbGVyKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblN0YWdlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byByZW1vdmUgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25TdGFnZUNoYW5nZSBldmVudC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIElmIGFuIGFub255bW91cyBmdW5jdGlvbiBpcyBzZXQgdXNpbmcgdGhlIGFkZE9uU3RhZ2VDaGFuZ2UgbWV0aG9kIGl0XHJcbiAgICAgKiAgICAgICAgICAgICAgICBjYW5ub3QgYmUgcmVtb3ZlZCB1c2luZyB0aGlzIG1ldGhvZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZU9uU3RhZ2VTZWxlY3RlZChoYW5kbGVyOiBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblN0YWdlU2VsZWN0ZWQoaGFuZGxlcik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyBtZXRob2QgdG8gYXN5bmNocm9ub3VzbHkgcmV0cmlldmUgdGhlIGVuYWJsZWQgYnVzaW5lc3MgcHJvY2VzcyBmbG93cyB0aGF0IHRoZSB1c2VyIGNhbiBzd2l0Y2ggdG8gZm9yIGFuIGVudGl0eS5cclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZ2V0RW5hYmxlZFByb2Nlc3NlcygpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuUHJvY2Vzc0RpY3Rpb25hcnk+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmdldEVuYWJsZWRQcm9jZXNzZXMsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3NcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyBhbGwgcHJvY2VzcyBpbnN0YW5jZXMgZm9yIHRoZSBlbnRpdHkgcmVjb3JkIHRoYXQgdGhlIGNhbGxpbmcgdXNlciBoYXMgYWNjZXNzIHRvLlxyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBnZXRQcm9jZXNzSW5zdGFuY2VzKCkge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5HZXRQcm9jZXNzSW5zdGFuY2VzRGVsZWdhdGU+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmdldFByb2Nlc3NJbnN0YW5jZXMsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3NcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogUHJvZ3Jlc3NlcyB0byB0aGUgbmV4dCBzdGFnZS5cclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgbW92ZU5leHQoKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LlByb2Nlc3NDYWxsYmFja0RlbGVnYXRlPihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5tb3ZlTmV4dCxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzc1xyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBNb3ZlcyB0byB0aGUgcHJldmlvdXMgc3RhZ2UuXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIG1vdmVQcmV2aW91cygpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuUHJvY2Vzc0NhbGxiYWNrRGVsZWdhdGU+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLm1vdmVQcmV2aW91cyxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzc1xyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXQgYSBQcm9jZXNzIGFzIHRoZSBhY3RpdmUgcHJvY2Vzcy5cclxuICAgICAqIEBwYXJhbSBwcm9jZXNzSWQgVGhlIElkIG9mIHRoZSBwcm9jZXNzIHRvIG1ha2UgdGhlIGFjdGl2ZSBwcm9jZXNzLlxyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRBY3RpdmVQcm9jZXNzKHByb2Nlc3NJZDogc3RyaW5nKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LlByb2Nlc3NDYWxsYmFja0RlbGVnYXRlPihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5zZXRBY3RpdmVQcm9jZXNzLFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLFxyXG4gICAgICAgIHByb2Nlc3NJZFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIGEgcHJvY2VzcyBpbnN0YW5jZSBhcyB0aGUgYWN0aXZlIGluc3RhbmNlXHJcbiAgICAgKiBAcGFyYW0gcHJvY2Vzc0luc3RhbmNlSWQgVGhlIElkIG9mIHRoZSBwcm9jZXNzIGluc3RhbmNlIHRvIG1ha2UgdGhlIGFjdGl2ZSBpbnN0YW5jZS5cclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0QWN0aXZlUHJvY2Vzc0luc3RhbmNlKHByb2Nlc3NJbnN0YW5jZUlkOiBzdHJpbmcpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuU2V0UHJvY2Vzc0luc3RhbmNlRGVsZWdhdGU+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnNldEFjdGl2ZVByb2Nlc3NJbnN0YW5jZSxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2VzcyxcclxuICAgICAgICBwcm9jZXNzSW5zdGFuY2VJZFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXQgYSBzdGFnZSBhcyB0aGUgYWN0aXZlIHN0YWdlLlxyXG4gICAgICogQHBhcmFtIHN0YWdlSWQgdGhlIElkIG9mIHRoZSBzdGFnZSB0byBtYWtlIHRoZSBhY3RpdmUgc3RhZ2UuXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldEFjdGl2ZVN0YWdlKHN0YWdlSWQ6IHN0cmluZykge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5TZXRQcm9jZXNzSW5zdGFuY2VEZWxlZ2F0ZT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3Muc2V0QWN0aXZlU3RhZ2UsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MsXHJcbiAgICAgICAgc3RhZ2VJZFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyBtZXRob2QgdG8gc2V0IHRoZSBjdXJyZW50IHN0YXR1cyBvZiB0aGUgcHJvY2VzcyBpbnN0YW5jZVxyXG4gICAgICogQHBhcmFtIHN0YXR1cyBUaGUgbmV3IHN0YXR1cyBmb3IgdGhlIHByb2Nlc3NcclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0U3RhdHVzKHN0YXR1czogWHJtLlByb2Nlc3NGbG93LlByb2Nlc3NTdGF0dXMpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuU2V0UHJvY2Vzc0luc3RhbmNlRGVsZWdhdGU+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnNldFN0YXR1cyxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2VzcyxcclxuICAgICAgICBzdGF0dXNcclxuICAgICAgKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGV4cG9ydCBjbGFzcyBGaWVsZHMge1xyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGEgaGFuZGxlciBvciBhbiBhcnJheSBvZiBoYW5kbGVycyB0byBiZSBjYWxsZWQgd2hlbiB0aGUgYXR0cmlidXRlJ3MgdmFsdWUgaXMgY2hhbmdlZC5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXJzIFRoZSBmdW5jdGlvbiByZWZlcmVuY2Ugb3IgYW4gYXJyYXkgb2YgZnVuY3Rpb24gcmVmZXJlbmNlcy5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uQ2hhbmdlKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIGhhbmRsZXI6IFhybS5FdmVudHMuQXR0cmlidXRlLkNoYW5nZUV2ZW50SGFuZGxlclxyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLmFkZE9uQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogRmlyZSBhbGwgXCJvbiBjaGFuZ2VcIiBldmVudCBoYW5kbGVycy5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZmlyZU9uQ2hhbmdlKGZpZWxkczogQ2xhc3MuRmllbGRbXSk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5maXJlT25DaGFuZ2UoKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFJlbW92ZXMgdGhlIGhhbmRsZXIgZnJvbSB0aGUgXCJvbiBjaGFuZ2VcIiBldmVudC5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGhhbmRsZXIuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVPbkNoYW5nZShcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICBoYW5kbGVyOiBYcm0uRXZlbnRzLkF0dHJpYnV0ZS5DaGFuZ2VFdmVudEhhbmRsZXJcclxuICAgICk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5yZW1vdmVPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgdGhlIHJlcXVpcmVkIGxldmVsLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gcmVxdWlyZW1lbnRMZXZlbCBUaGUgcmVxdWlyZW1lbnQgbGV2ZWwsIGFzIGVpdGhlciBcIm5vbmVcIiwgXCJyZXF1aXJlZFwiLCBvciBcInJlY29tbWVuZGVkXCJcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldFJlcXVpcmVkTGV2ZWwoXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgcmVxdWlyZW1lbnRMZXZlbDogWHJtLkF0dHJpYnV0ZXMuUmVxdWlyZW1lbnRMZXZlbFxyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldFJlcXVpcmVkTGV2ZWwocmVxdWlyZW1lbnRMZXZlbCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSBzdWJtaXQgbW9kZS5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIHN1Ym1pdE1vZGUgVGhlIHN1Ym1pdCBtb2RlLCBhcyBlaXRoZXIgXCJhbHdheXNcIiwgXCJuZXZlclwiLCBvciBcImRpcnR5XCIuXHJcbiAgICAgKiBAZGVmYXVsdCBzdWJtaXRNb2RlIFwiZGlydHlcIlxyXG4gICAgICogQHNlZSB7QGxpbmsgWHJtRW51bS5BdHRyaWJ1dGVSZXF1aXJlbWVudExldmVsfVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0U3VibWl0TW9kZShcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICBzdWJtaXRNb2RlOiBYcm0uU3VibWl0TW9kZVxyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldFN1Ym1pdE1vZGUoc3VibWl0TW9kZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSB2YWx1ZS5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZS5cclxuICAgICAqIEByZW1hcmtzIEF0dHJpYnV0ZXMgb24gUXVpY2sgQ3JlYXRlIEZvcm1zIHdpbGwgbm90IHNhdmUgdmFsdWVzIHNldCB3aXRoIHRoaXMgbWV0aG9kLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0VmFsdWUoZmllbGRzOiBDbGFzcy5GaWVsZFtdLCB2YWx1ZTogYW55KTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgYSB2YWx1ZSBmb3IgYSBjb2x1bW4gdG8gZGV0ZXJtaW5lIHdoZXRoZXIgaXQgaXMgdmFsaWQgb3IgaW52YWxpZCB3aXRoIGEgbWVzc2FnZVxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gaXNWYWxpZCBTcGVjaWZ5IGZhbHNlIHRvIHNldCB0aGUgY29sdW1uIHZhbHVlIHRvIGludmFsaWQgYW5kIHRydWUgdG8gc2V0IHRoZSB2YWx1ZSB0byB2YWxpZC5cclxuICAgICAqIEBwYXJhbSBtZXNzYWdlIFRoZSBtZXNzYWdlIHRvIGRpc3BsYXkuXHJcbiAgICAgKiBAc2VlIHtAbGluayBodHRwczovL2xlYXJuLm1pY3Jvc29mdC5jb20vZW4tdXMvcG93ZXItYXBwcy9kZXZlbG9wZXIvbW9kZWwtZHJpdmVuLWFwcHMvY2xpZW50YXBpL3JlZmVyZW5jZS9hdHRyaWJ1dGVzL3NldGlzdmFsaWQgRXh0ZXJuYWwgTGluazogc2V0SXNWYWxpZCAoQ2xpZW50IEFQSSByZWZlcmVuY2UpfVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0SXNWYWxpZChcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICBpc1ZhbGlkOiBib29sZWFuLFxyXG4gICAgICBtZXNzYWdlPzogc3RyaW5nXHJcbiAgICApOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0SXNWYWxpZChpc1ZhbGlkLCBtZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgdGhlIHJlcXVpcmVkIGxldmVsLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gcmVxdWlyZWQgVGhlIHJlcXVpcmVtZW50IGxldmVsLCBhcyBlaXRoZXIgZmFsc2UgZm9yIFwibm9uZVwiIG9yIHRydWUgZm9yIFwicmVxdWlyZWRcIlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0UmVxdWlyZWQoZmllbGRzOiBDbGFzcy5GaWVsZFtdLCByZXF1aXJlZDogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXRSZXF1aXJlZChyZXF1aXJlZCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSBzdGF0ZSBvZiB0aGUgY29udHJvbCB0byBlaXRoZXIgZW5hYmxlZCwgb3IgZGlzYWJsZWQuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSBkaXNhYmxlZCB0cnVlIHRvIGRpc2FibGUsIGZhbHNlIHRvIGVuYWJsZS5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldERpc2FibGVkKGZpZWxkczogQ2xhc3MuRmllbGRbXSwgZGlzYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0RGlzYWJsZWQoZGlzYWJsZWQpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgdmlzaWJpbGl0eSBzdGF0ZS5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIHZpc2libGUgdHJ1ZSB0byBzaG93LCBmYWxzZSB0byBoaWRlLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0VmlzaWJsZShmaWVsZHM6IENsYXNzLkZpZWxkW10sIHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0VmlzaWJsZSh2aXNpYmxlKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgYSBjb250cm9sLWxvY2FsIG5vdGlmaWNhdGlvbiBtZXNzYWdlLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBUaGUgbWVzc2FnZS5cclxuICAgICAqIEBwYXJhbSB1bmlxdWVJZCBVbmlxdWUgaWRlbnRpZmllci5cclxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgaXQgc3VjY2VlZHMsIGZhbHNlIGlmIGl0IGZhaWxzLlxyXG4gICAgICogQHJlbWFya3MgICAgIFdoZW4gdGhpcyBtZXRob2QgaXMgdXNlZCBvbiBNaWNyb3NvZnQgRHluYW1pY3MgQ1JNIGZvciB0YWJsZXRzIGEgcmVkIFwiWFwiIGljb25cclxuICAgICAqICAgICAgICAgICAgICBhcHBlYXJzIG5leHQgdG8gdGhlIGNvbnRyb2wuIFRhcHBpbmcgb24gdGhlIGljb24gd2lsbCBkaXNwbGF5IHRoZSBtZXNzYWdlLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0Tm90aWZpY2F0aW9uKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIG1lc3NhZ2U6IHN0cmluZyxcclxuICAgICAgdW5pcXVlSWQ6IHN0cmluZ1xyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldE5vdGlmaWNhdGlvbihtZXNzYWdlLCB1bmlxdWVJZCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBEaXNwbGF5cyBhbiBlcnJvciBvciByZWNvbW1lbmRhdGlvbiBub3RpZmljYXRpb24gZm9yIGEgY29udHJvbCwgYW5kIGxldHMgeW91IHNwZWNpZnkgYWN0aW9ucyB0byBleGVjdXRlIGJhc2VkIG9uIHRoZSBub3RpZmljYXRpb24uXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE5vdGlmaWNhdGlvbihcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsXHJcbiAgICAgIG5vdGlmaWNhdGlvbkxldmVsOiBcIkVSUk9SXCIgfCBcIlJFQ09NTUVOREFUSU9OXCIsXHJcbiAgICAgIHVuaXF1ZUlkOiBzdHJpbmcsXHJcbiAgICAgIGFjdGlvbnM/OiBYcm0uQ29udHJvbHMuQ29udHJvbE5vdGlmaWNhdGlvbkFjdGlvbltdXHJcbiAgICApOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuYWRkTm90aWZpY2F0aW9uKG1lc3NhZ2UsIG5vdGlmaWNhdGlvbkxldmVsLCB1bmlxdWVJZCwgYWN0aW9ucyk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBDbGVhcnMgdGhlIG5vdGlmaWNhdGlvbiBpZGVudGlmaWVkIGJ5IHVuaXF1ZUlkLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gdW5pcXVlSWQgKE9wdGlvbmFsKSBVbmlxdWUgaWRlbnRpZmllci5cclxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgaXQgc3VjY2VlZHMsIGZhbHNlIGlmIGl0IGZhaWxzLlxyXG4gICAgICogQHJlbWFya3MgSWYgdGhlIHVuaXF1ZUlkIHBhcmFtZXRlciBpcyBub3QgdXNlZCwgdGhlIGN1cnJlbnQgbm90aWZpY2F0aW9uIHNob3duIHdpbGwgYmUgcmVtb3ZlZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZU5vdGlmaWNhdGlvbihmaWVsZHM6IENsYXNzLkZpZWxkW10sIHVuaXF1ZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQucmVtb3ZlTm90aWZpY2F0aW9uKHVuaXF1ZUlkKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXByZXNlbnRzIGEgZm9ybSBpbiBEeW5hbWljcyAzNjUuXHJcbiAgICovXHJcbiAgZXhwb3J0IGNsYXNzIEZvcm0ge1xyXG4gICAgcHJvdGVjdGVkIHN0YXRpYyBfZm9ybUNvbnRleHQ6IFhybS5Gb3JtQ29udGV4dDtcclxuICAgIHByb3RlY3RlZCBzdGF0aWMgX2V4ZWN1dGlvbkNvbnRleHQ6IFhybS5FdmVudHMuRXZlbnRDb250ZXh0O1xyXG4gICAgY29uc3RydWN0b3IoKSB7fVxyXG4gICAgLyoqR2V0cyBhIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCBmb3JtIGNvbnRleHQqL1xyXG4gICAgc3RhdGljIGdldCBmb3JtQ29udGV4dCgpOiBYcm0uRm9ybUNvbnRleHQge1xyXG4gICAgICByZXR1cm4gdGhpcy5fZm9ybUNvbnRleHQ7XHJcbiAgICB9XHJcbiAgICAvKipHZXRzIGEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IGV4ZWN1dGlvIGNvbnRleHQqL1xyXG4gICAgc3RhdGljIGdldCBleGVjdXRpb25Db250ZXh0KCk6IFhybS5FdmVudHMuRXZlbnRDb250ZXh0IHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2V4ZWN1dGlvbkNvbnRleHQ7XHJcbiAgICB9XHJcbiAgICAvKipHZXRzIGEgbG9va3VwIHZhbHVlIHRoYXQgcmVmZXJlbmNlcyB0aGUgcmVjb3JkLiovXHJcbiAgICBzdGF0aWMgZ2V0IGVudGl0eVJlZmVyZW5jZSgpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5lbnRpdHkuZ2V0RW50aXR5UmVmZXJlbmNlKCk7XHJcbiAgICB9XHJcbiAgICAvKipTZXRzIGEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IGZvcm0gY29udGV4dCovXHJcbiAgICBzdGF0aWMgc2V0IGZvcm1Db250ZXh0KGNvbnRleHQ6IFhybS5Gb3JtQ29udGV4dCB8IFhybS5FdmVudHMuRXZlbnRDb250ZXh0KSB7XHJcbiAgICAgIGlmICghY29udGV4dClcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICBgWHJtRXguRm9ybS5zZXRGb3JtQ29udGV4dDogVGhlIGV4ZWN1dGlvbkNvbnRleHQgb3IgZm9ybUNvbnRleHQgd2FzIG5vdCBwYXNzZWQgdG8gdGhlIGZ1bmN0aW9uLmBcclxuICAgICAgICApO1xyXG4gICAgICBpZiAoXCJnZXRGb3JtQ29udGV4dFwiIGluIGNvbnRleHQpIHtcclxuICAgICAgICB0aGlzLl9leGVjdXRpb25Db250ZXh0ID0gY29udGV4dDtcclxuICAgICAgICB0aGlzLl9mb3JtQ29udGV4dCA9IGNvbnRleHQuZ2V0Rm9ybUNvbnRleHQoKTtcclxuICAgICAgfSBlbHNlIGlmIChcImRhdGFcIiBpbiBjb250ZXh0KSB0aGlzLl9mb3JtQ29udGV4dCA9IGNvbnRleHQ7XHJcbiAgICAgIGVsc2VcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICBgWHJtRXguRm9ybS5zZXRGb3JtQ29udGV4dDogVGhlIHBhc3NlZCBjb250ZXh0IGlzIG5vdCBhbiBleGVjdXRpb25Db250ZXh0IG9yIGZvcm1Db250ZXh0LmBcclxuICAgICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqU2V0cyBhIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCBleGVjdXRpb24gY29udGV4dCovXHJcbiAgICBzdGF0aWMgc2V0IGV4ZWN1dGlvbkNvbnRleHQoXHJcbiAgICAgIGNvbnRleHQ6IFhybS5Gb3JtQ29udGV4dCB8IFhybS5FdmVudHMuRXZlbnRDb250ZXh0XHJcbiAgICApIHtcclxuICAgICAgaWYgKCFjb250ZXh0KVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgIGBYcm1FeC5Gb3JtLnNldEV4ZWN1dGlvbkNvbnRleHQ6IFRoZSBleGVjdXRpb25Db250ZXh0IG9yIGZvcm1Db250ZXh0IHdhcyBub3QgcGFzc2VkIHRvIHRoZSBmdW5jdGlvbi5gXHJcbiAgICAgICAgKTtcclxuICAgICAgaWYgKFwiZ2V0Rm9ybUNvbnRleHRcIiBpbiBjb250ZXh0KSB7XHJcbiAgICAgICAgdGhpcy5fZXhlY3V0aW9uQ29udGV4dCA9IGNvbnRleHQ7XHJcbiAgICAgICAgdGhpcy5fZm9ybUNvbnRleHQgPSBjb250ZXh0LmdldEZvcm1Db250ZXh0KCk7XHJcbiAgICAgIH0gZWxzZSBpZiAoXCJkYXRhXCIgaW4gY29udGV4dCkgdGhpcy5fZm9ybUNvbnRleHQgPSBjb250ZXh0O1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgYFhybUV4LkZvcm0uc2V0RXhlY3V0aW9uQ29udGV4dDogVGhlIHBhc3NlZCBjb250ZXh0IGlzIG5vdCBhbiBleGVjdXRpb25Db250ZXh0IG9yIGZvcm1Db250ZXh0LmBcclxuICAgICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqUmV0dXJucyB0cnVlIGlmIGZvcm0gaXMgZnJvbSB0eXBlIGNyZWF0ZSovXHJcbiAgICBzdGF0aWMgZ2V0IElzQ3JlYXRlKCkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC51aS5nZXRGb3JtVHlwZSgpID09IDE7XHJcbiAgICB9XHJcbiAgICAvKipSZXR1cm5zIHRydWUgaWYgZm9ybSBpcyBmcm9tIHR5cGUgdXBkYXRlKi9cclxuICAgIHN0YXRpYyBnZXQgSXNVcGRhdGUoKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LnVpLmdldEZvcm1UeXBlKCkgPT0gMjtcclxuICAgIH1cclxuICAgIC8qKlJldHVybnMgdHJ1ZSBpZiBmb3JtIGlzIG5vdCBmcm9tIHR5cGUgY3JlYXRlKi9cclxuICAgIHN0YXRpYyBnZXQgSXNOb3RDcmVhdGUoKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LnVpLmdldEZvcm1UeXBlKCkgIT0gMTtcclxuICAgIH1cclxuICAgIC8qKlJldHVybnMgdHJ1ZSBpZiBmb3JtIGlzIG5vdCBmcm9tIHR5cGUgdXBkYXRlKi9cclxuICAgIHN0YXRpYyBnZXQgSXNOb3RVcGRhdGUoKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LnVpLmdldEZvcm1UeXBlKCkgIT0gMjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERpc3BsYXlzIGEgZm9ybSBsZXZlbCBub3RpZmljYXRpb24uIEFueSBudW1iZXIgb2Ygbm90aWZpY2F0aW9ucyBjYW4gYmUgZGlzcGxheWVkIGFuZCB3aWxsIHJlbWFpbiB1bnRpbCByZW1vdmVkIHVzaW5nIGNsZWFyRm9ybU5vdGlmaWNhdGlvbi5cclxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIG5vdGlmaWNhdGlvbiBhcmVhIGlzIGxpbWl0ZWQgc28gZWFjaCBuZXcgbWVzc2FnZSB3aWxsIGJlIGFkZGVkIHRvIHRoZSB0b3AuXHJcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBUaGUgdGV4dCBvZiB0aGUgbm90aWZpY2F0aW9uIG1lc3NhZ2UuXHJcbiAgICAgKiBAcGFyYW0gbGV2ZWwgVGhlIGxldmVsIG9mIHRoZSBub3RpZmljYXRpb24gd2hpY2ggZGVmaW5lcyBob3cgdGhlIG1lc3NhZ2Ugd2lsbCBiZSBkaXNwbGF5ZWQsIHN1Y2ggYXMgdGhlIGljb24uXHJcbiAgICAgKiBFUlJPUjogTm90aWZpY2F0aW9uIHdpbGwgdXNlIHRoZSBzeXN0ZW0gZXJyb3IgaWNvbi5cclxuICAgICAqIFdBUk5JTkc6IE5vdGlmaWNhdGlvbiB3aWxsIHVzZSB0aGUgc3lzdGVtIHdhcm5pbmcgaWNvbi5cclxuICAgICAqIElORk86IE5vdGlmaWNhdGlvbiB3aWxsIHVzZSB0aGUgc3lzdGVtIGluZm8gaWNvbi5cclxuICAgICAqIEBwYXJhbSB1bmlxdWVJZCBVbmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIG5vdGlmaWNhdGlvbiB3aGljaCBpcyB1c2VkIHdpdGggY2xlYXJGb3JtTm90aWZpY2F0aW9uIHRvIHJlbW92ZSB0aGUgbm90aWZpY2F0aW9uLlxyXG4gICAgICogQHJldHVybnMgdHJ1ZSBpZiBpdCBzdWNjZWVkcywgb3RoZW5wcndpc2UgZmFsc2UuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRGb3JtTm90aWZpY2F0aW9uKFxyXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsXHJcbiAgICAgIGxldmVsOiBYcm0uRm9ybU5vdGlmaWNhdGlvbkxldmVsLFxyXG4gICAgICB1bmlxdWVJZDogc3RyaW5nXHJcbiAgICApIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC51aS5zZXRGb3JtTm90aWZpY2F0aW9uKFxyXG4gICAgICAgICAgbWVzc2FnZSxcclxuICAgICAgICAgIGxldmVsLFxyXG4gICAgICAgICAgdW5pcXVlSWRcclxuICAgICAgICApO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQ2xlYXJzIHRoZSBmb3JtIG5vdGlmaWNhdGlvbiBkZXNjcmliZWQgYnkgdW5pcXVlSWQuXHJcbiAgICAgKiBAcGFyYW0gdW5pcXVlSWQgVW5pcXVlIGlkZW50aWZpZXIuXHJcbiAgICAgKiBAcmV0dXJucyBUcnVlIGlmIGl0IHN1Y2NlZWRzLCBvdGhlcndpc2UgZmFsc2UuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVGb3JtTm90aWZpY2F0aW9uKHVuaXF1ZUlkOiBzdHJpbmcpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC51aS5jbGVhckZvcm1Ob3RpZmljYXRpb24odW5pcXVlSWQpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhIGhhbmRsZXIgdG8gYmUgY2FsbGVkIHdoZW4gdGhlIHJlY29yZCBpcyBzYXZlZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uU2F2ZShcclxuICAgICAgaGFuZGxlcnM6XHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyXHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyW11cclxuICAgICkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShoYW5kbGVycykpIHtcclxuICAgICAgICAgIGhhbmRsZXJzID0gW2hhbmRsZXJzXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFuZGxlcnMuZm9yRWFjaCgoaGFuZGxlcikgPT4ge1xyXG4gICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtoYW5kbGVyfScgaXMgbm90IGEgZnVuY3Rpb25gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5lbnRpdHkucmVtb3ZlT25TYXZlKGhhbmRsZXIpO1xyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLmVudGl0eS5hZGRPblNhdmUoaGFuZGxlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBPblNhdmUgaXMgY29tcGxldGUuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgaGFuZGxlci5cclxuICAgICAqIEByZW1hcmtzIEFkZGVkIGluIDkuMlxyXG4gICAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvcG93ZXJhcHBzL2RldmVsb3Blci9tb2RlbC1kcml2ZW4tYXBwcy9jbGllbnRhcGkvcmVmZXJlbmNlL2V2ZW50cy9wb3N0c2F2ZSBFeHRlcm5hbCBMaW5rOiBQb3N0U2F2ZSBFdmVudCBEb2N1bWVudGF0aW9ufVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25Qb3N0U2F2ZShcclxuICAgICAgaGFuZGxlcnM6XHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyXHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyW11cclxuICAgICkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShoYW5kbGVycykpIHtcclxuICAgICAgICAgIGhhbmRsZXJzID0gW2hhbmRsZXJzXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFuZGxlcnMuZm9yRWFjaCgoaGFuZGxlcikgPT4ge1xyXG4gICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtoYW5kbGVyfScgaXMgbm90IGEgZnVuY3Rpb25gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5lbnRpdHkucmVtb3ZlT25Qb3N0U2F2ZShoYW5kbGVyKTtcclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5lbnRpdHkuYWRkT25Qb3N0U2F2ZShoYW5kbGVyKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIEFkZHMgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2hlbiBmb3JtIGRhdGEgaXMgbG9hZGVkLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGJlIGV4ZWN1dGVkIHdoZW4gdGhlIGZvcm0gZGF0YSBsb2Fkcy4gVGhlIGZ1bmN0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnQgaGFuZGxlciBwaXBlbGluZS5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uTG9hZChcclxuICAgICAgaGFuZGxlcnM6XHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyXHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyW11cclxuICAgICkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShoYW5kbGVycykpIHtcclxuICAgICAgICAgIGhhbmRsZXJzID0gW2hhbmRsZXJzXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFuZGxlcnMuZm9yRWFjaCgoaGFuZGxlcikgPT4ge1xyXG4gICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtoYW5kbGVyfScgaXMgbm90IGEgZnVuY3Rpb25gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5yZW1vdmVPbkxvYWQoaGFuZGxlcik7XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEuYWRkT25Mb2FkKGhhbmRsZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhIGhhbmRsZXIgdG8gYmUgY2FsbGVkIHdoZW4gdGhlIGF0dHJpYnV0ZSdzIHZhbHVlIGlzIGNoYW5nZWQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gcmVmZXJlbmNlLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25DaGFuZ2UoXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgaGFuZGxlcnM6XHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyXHJcbiAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyW10sXHJcbiAgICAgIGV4ZWN1dGU/OiBib29sZWFuXHJcbiAgICApIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoaGFuZGxlcnMpKSB7XHJcbiAgICAgICAgICBoYW5kbGVycyA9IFtoYW5kbGVyc107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGhhbmRsZXJzLmZvckVhY2goKGhhbmRsZXIpID0+IHtcclxuICAgICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJyR7aGFuZGxlcn0nIGlzIG5vdCBhIGZ1bmN0aW9uYCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICAgICAgZmllbGQucmVtb3ZlT25DaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgICAgICAgIGZpZWxkLmFkZE9uQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKGV4ZWN1dGUpIHtcclxuICAgICAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgICAgICBmaWVsZC5BdHRyaWJ1dGUuZmlyZU9uQ2hhbmdlKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZXhwb3J0IG5hbWVzcGFjZSBDbGFzcyB7XHJcbiAgICAvKipcclxuICAgICAqIFVzZWQgdG8gZXhlY3V0ZSBtZXRob2RzIHJlbGF0ZWQgdG8gYSBzaW5nbGUgQXR0cmlidXRlXHJcbiAgICAgKi9cclxuICAgIGV4cG9ydCBjbGFzcyBGaWVsZCBpbXBsZW1lbnRzIFhybS5BdHRyaWJ1dGVzLkF0dHJpYnV0ZSB7XHJcbiAgICAgIHB1YmxpYyBzdGF0aWMgYWxsRmllbGRzOiBGaWVsZFtdID0gW107XHJcblxyXG4gICAgICBwdWJsaWMgcmVhZG9ubHkgTmFtZSE6IHN0cmluZztcclxuICAgICAgcHJvdGVjdGVkIF9hdHRyaWJ1dGU/OiBYcm0uQXR0cmlidXRlcy5BdHRyaWJ1dGU7XHJcblxyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGVOYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICBjb25zdCBleGlzdGluZ0ZpZWxkID0gRmllbGQuYWxsRmllbGRzLmZpbmQoXHJcbiAgICAgICAgICAoZikgPT4gZi5OYW1lID09PSBhdHRyaWJ1dGVOYW1lXHJcbiAgICAgICAgKTtcclxuICAgICAgICBpZiAoZXhpc3RpbmdGaWVsZCkge1xyXG4gICAgICAgICAgcmV0dXJuIGV4aXN0aW5nRmllbGQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuTmFtZSA9IGF0dHJpYnV0ZU5hbWU7XHJcbiAgICAgICAgRmllbGQuYWxsRmllbGRzLnB1c2godGhpcyk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0VmFsdWUodmFsdWU6IGFueSk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0QXR0cmlidXRlVHlwZSgpOiBYcm0uQXR0cmlidXRlcy5BdHRyaWJ1dGVUeXBlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0QXR0cmlidXRlVHlwZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEZvcm1hdCgpOiBYcm0uQXR0cmlidXRlcy5BdHRyaWJ1dGVGb3JtYXQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRGb3JtYXQoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRJc0RpcnR5KCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRJc0RpcnR5KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXROYW1lKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0UGFyZW50KCk6IFhybS5FbnRpdHkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRQYXJlbnQoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRSZXF1aXJlZExldmVsKCk6IFhybS5BdHRyaWJ1dGVzLlJlcXVpcmVtZW50TGV2ZWwge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRSZXF1aXJlZExldmVsKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0U3VibWl0TW9kZSgpOiBYcm0uU3VibWl0TW9kZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFN1Ym1pdE1vZGUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRVc2VyUHJpdmlsZWdlKCk6IFhybS5Qcml2aWxlZ2Uge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRVc2VyUHJpdmlsZWdlKCk7XHJcbiAgICAgIH1cclxuICAgICAgcmVtb3ZlT25DaGFuZ2UoaGFuZGxlcjogWHJtLkV2ZW50cy5BdHRyaWJ1dGUuQ2hhbmdlRXZlbnRIYW5kbGVyKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLnJlbW92ZU9uQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFN1Ym1pdE1vZGUoc3VibWl0TW9kZTogWHJtLlN1Ym1pdE1vZGUpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuc2V0U3VibWl0TW9kZShzdWJtaXRNb2RlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRWYWx1ZSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRJc1ZhbGlkKGlzVmFsaWQ6IGJvb2xlYW4sIG1lc3NhZ2U/OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuc2V0SXNWYWxpZChpc1ZhbGlkLCBtZXNzYWdlKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgcHVibGljIGdldCBBdHRyaWJ1dGUoKTogWHJtLkF0dHJpYnV0ZXMuQXR0cmlidXRlIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoXHJcbiAgICAgICAgICAgIGBUaGUgYXR0cmlidXRlICcke3RoaXMuTmFtZX0nIHdhcyBub3QgZm91bmQgb24gdGhlIGZvcm0uYFxyXG4gICAgICAgICAgKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHB1YmxpYyBnZXQgY29udHJvbHMoKTogWHJtLkNvbGxlY3Rpb24uSXRlbUNvbGxlY3Rpb248WHJtLkNvbnRyb2xzLlN0YW5kYXJkQ29udHJvbD4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEdldHMgdGhlIHZhbHVlLlxyXG4gICAgICAgKiBAcmV0dXJucyBUaGUgdmFsdWUuXHJcbiAgICAgICAqL1xyXG4gICAgICBwdWJsaWMgZ2V0IFZhbHVlKCk6IGFueSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHB1YmxpYyBzZXQgVmFsdWUodmFsdWU6IGFueSkge1xyXG4gICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFNldHMgYSBjb250cm9sLWxvY2FsIG5vdGlmaWNhdGlvbiBtZXNzYWdlLlxyXG4gICAgICAgKiBAcGFyYW0gbWVzc2FnZSBUaGUgbWVzc2FnZS5cclxuICAgICAgICogQHBhcmFtIHVuaXF1ZUlkIFVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgICAgKiBAcmV0dXJucyB0cnVlIGlmIGl0IHN1Y2NlZWRzLCBmYWxzZSBpZiBpdCBmYWlscy5cclxuICAgICAgICogQHJlbWFya3MgICAgIFdoZW4gdGhpcyBtZXRob2QgaXMgdXNlZCBvbiBNaWNyb3NvZnQgRHluYW1pY3MgQ1JNIGZvciB0YWJsZXRzIGEgcmVkIFwiWFwiIGljb25cclxuICAgICAgICogICAgICAgICAgICAgIGFwcGVhcnMgbmV4dCB0byB0aGUgY29udHJvbC4gVGFwcGluZyBvbiB0aGUgaWNvbiB3aWxsIGRpc3BsYXkgdGhlIG1lc3NhZ2UuXHJcbiAgICAgICAqL1xyXG4gICAgICBwdWJsaWMgc2V0Tm90aWZpY2F0aW9uKG1lc3NhZ2U6IHN0cmluZywgdW5pcXVlSWQ6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHRocm93IG5ldyBFcnJvcihgbm8gbWVzc2FnZSB3YXMgcHJvdmlkZWQuYCk7XHJcbiAgICAgICAgICBpZiAoIXVuaXF1ZUlkKSB0aHJvdyBuZXcgRXJyb3IoYG5vIHVuaXF1ZUlkIHdhcyBwcm92aWRlZC5gKTtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT5cclxuICAgICAgICAgICAgY29udHJvbC5zZXROb3RpZmljYXRpb24obWVzc2FnZSwgdW5pcXVlSWQpXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogU2V0cyB0aGUgdmlzaWJpbGl0eSBzdGF0ZS5cclxuICAgICAgICogQHBhcmFtIHZpc2libGUgdHJ1ZSB0byBzaG93LCBmYWxzZSB0byBoaWRlLlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IGNvbnRyb2wuc2V0VmlzaWJsZSh2aXNpYmxlKSk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBTZXRzIHRoZSBzdGF0ZSBvZiB0aGUgY29udHJvbCB0byBlaXRoZXIgZW5hYmxlZCwgb3IgZGlzYWJsZWQuXHJcbiAgICAgICAqIEBwYXJhbSBkaXNhYmxlZCB0cnVlIHRvIGRpc2FibGUsIGZhbHNlIHRvIGVuYWJsZS5cclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBzZXREaXNhYmxlZChkaXNhYmxlZDogYm9vbGVhbik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IGNvbnRyb2wuc2V0RGlzYWJsZWQoZGlzYWJsZWQpKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFNldHMgdGhlIHJlcXVpcmVkIGxldmVsLlxyXG4gICAgICAgKiBAcGFyYW0gcmVxdWlyZW1lbnRMZXZlbCBUaGUgcmVxdWlyZW1lbnQgbGV2ZWwsIGFzIGVpdGhlciBcIm5vbmVcIiwgXCJyZXF1aXJlZFwiLCBvciBcInJlY29tbWVuZGVkXCJcclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBzZXRSZXF1aXJlZExldmVsKFxyXG4gICAgICAgIHJlcXVpcmVtZW50TGV2ZWw6IFhybS5BdHRyaWJ1dGVzLlJlcXVpcmVtZW50TGV2ZWxcclxuICAgICAgKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFJlcXVpcmVkTGV2ZWwocmVxdWlyZW1lbnRMZXZlbCk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBTZXRzIHRoZSByZXF1aXJlZCBsZXZlbC5cclxuICAgICAgICogQHBhcmFtIHJlcXVpcmVkIFRoZSByZXF1aXJlbWVudCBsZXZlbCwgYXMgZWl0aGVyIGZhbHNlIGZvciBcIm5vbmVcIiBvciB0cnVlIGZvciBcInJlcXVpcmVkXCJcclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBzZXRSZXF1aXJlZChyZXF1aXJlZDogYm9vbGVhbik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRSZXF1aXJlZExldmVsKHJlcXVpcmVkID8gXCJyZXF1aXJlZFwiIDogXCJub25lXCIpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipGaXJlIGFsbCBcIm9uIGNoYW5nZVwiIGV2ZW50IGhhbmRsZXJzLiAqL1xyXG4gICAgICBwdWJsaWMgZmlyZU9uQ2hhbmdlKCk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5maXJlT25DaGFuZ2UoKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEFkZHMgYSBoYW5kbGVyIG9yIGFuIGFycmF5IG9mIGhhbmRsZXJzIHRvIGJlIGNhbGxlZCB3aGVuIHRoZSBhdHRyaWJ1dGUncyB2YWx1ZSBpcyBjaGFuZ2VkLlxyXG4gICAgICAgKiBAcGFyYW0gaGFuZGxlcnMgVGhlIGZ1bmN0aW9uIHJlZmVyZW5jZSBvciBhbiBhcnJheSBvZiBmdW5jdGlvbiByZWZlcmVuY2VzLlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIGFkZE9uQ2hhbmdlKFxyXG4gICAgICAgIGhhbmRsZXJzOlxyXG4gICAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyXHJcbiAgICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJbXVxyXG4gICAgICApOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcnMpKSB7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgaGFuZGxlciBvZiBoYW5kbGVycykge1xyXG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtoYW5kbGVyfScgaXMgbm90IGEgZnVuY3Rpb25gKTtcclxuICAgICAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5yZW1vdmVPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5hZGRPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVycyAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJyR7aGFuZGxlcnN9JyBpcyBub3QgYSBmdW5jdGlvbmApO1xyXG4gICAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5yZW1vdmVPbkNoYW5nZShoYW5kbGVycyk7XHJcbiAgICAgICAgICAgIHRoaXMuQXR0cmlidXRlLmFkZE9uQ2hhbmdlKGhhbmRsZXJzKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIERpc3BsYXlzIGFuIGVycm9yIG9yIHJlY29tbWVuZGF0aW9uIG5vdGlmaWNhdGlvbiBmb3IgYSBjb250cm9sLCBhbmQgbGV0cyB5b3Ugc3BlY2lmeSBhY3Rpb25zIHRvIGV4ZWN1dGUgYmFzZWQgb24gdGhlIG5vdGlmaWNhdGlvbi5cclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBhZGROb3RpZmljYXRpb24oXHJcbiAgICAgICAgbWVzc2FnZTogc3RyaW5nLFxyXG4gICAgICAgIG5vdGlmaWNhdGlvbkxldmVsOiBcIkVSUk9SXCIgfCBcIlJFQ09NTUVOREFUSU9OXCIsXHJcbiAgICAgICAgdW5pcXVlSWQ6IHN0cmluZyxcclxuICAgICAgICBhY3Rpb25zPzogWHJtLkNvbnRyb2xzLkNvbnRyb2xOb3RpZmljYXRpb25BY3Rpb25bXVxyXG4gICAgICApOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKCF1bmlxdWVJZCkgdGhyb3cgbmV3IEVycm9yKGBubyB1bmlxdWVJZCB3YXMgcHJvdmlkZWQuYCk7XHJcbiAgICAgICAgICBpZiAoYWN0aW9ucyAmJiAhQXJyYXkuaXNBcnJheShhY3Rpb25zKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgIGB0aGUgYWN0aW9uIHBhcmFtZXRlciBpcyBub3QgYW4gYXJyYXkgb2YgQ29udHJvbE5vdGlmaWNhdGlvbkFjdGlvbmBcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZE5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFttZXNzYWdlXSxcclxuICAgICAgICAgICAgICBub3RpZmljYXRpb25MZXZlbDogbm90aWZpY2F0aW9uTGV2ZWwsXHJcbiAgICAgICAgICAgICAgdW5pcXVlSWQ6IHVuaXF1ZUlkLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IGFjdGlvbnMsXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIENsZWFycyB0aGUgbm90aWZpY2F0aW9uIGlkZW50aWZpZWQgYnkgdW5pcXVlSWQuXHJcbiAgICAgICAqIEBwYXJhbSB1bmlxdWVJZCAoT3B0aW9uYWwpIFVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgICAgKiBAcmV0dXJucyB0cnVlIGlmIGl0IHN1Y2NlZWRzLCBmYWxzZSBpZiBpdCBmYWlscy5cclxuICAgICAgICogQHJlbWFya3MgSWYgdGhlIHVuaXF1ZUlkIHBhcmFtZXRlciBpcyBub3QgdXNlZCwgdGhlIGN1cnJlbnQgbm90aWZpY2F0aW9uIHNob3duIHdpbGwgYmUgcmVtb3ZlZC5cclxuICAgICAgICovXHJcbiAgICAgIHJlbW92ZU5vdGlmaWNhdGlvbih1bmlxdWVJZDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmNsZWFyTm90aWZpY2F0aW9uKHVuaXF1ZUlkKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgVGV4dEZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5TdHJpbmdBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuU3RyaW5nQXR0cmlidXRlO1xyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGU6IHN0cmluZykge1xyXG4gICAgICAgIHN1cGVyKGF0dHJpYnV0ZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TWF4TGVuZ3RoKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE1heExlbmd0aCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEZvcm1hdCgpOiBYcm0uQXR0cmlidXRlcy5TdHJpbmdBdHRyaWJ1dGVGb3JtYXQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRGb3JtYXQoKSBhcyBYcm0uQXR0cmlidXRlcy5TdHJpbmdBdHRyaWJ1dGVGb3JtYXQ7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IEF0dHJpYnV0ZSgpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYEZpZWxkICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9scygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCkgPz8gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBzZXQgVmFsdWUodmFsdWU6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIE51bWJlckZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5OdW1iZXJBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuTnVtYmVyQXR0cmlidXRlO1xyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGU6IHN0cmluZykge1xyXG4gICAgICAgIHN1cGVyKGF0dHJpYnV0ZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Rm9ybWF0KCk6IFhybS5BdHRyaWJ1dGVzLkludGVnZXJBdHRyaWJ1dGVGb3JtYXQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRGb3JtYXQoKSBhcyBYcm0uQXR0cmlidXRlcy5JbnRlZ2VyQXR0cmlidXRlRm9ybWF0O1xyXG4gICAgICB9XHJcbiAgICAgIGdldE1heCgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRNYXgoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRNaW4oKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0TWluKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0UHJlY2lzaW9uKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFByZWNpc2lvbigpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFByZWNpc2lvbihwcmVjaXNpb246IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5zZXRQcmVjaXNpb24ocHJlY2lzaW9uKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKSA/PyBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgRGF0ZUZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5EYXRlQXR0cmlidXRlXHJcbiAgICB7XHJcbiAgICAgIHByb3RlY3RlZCBkZWNsYXJlIF9hdHRyaWJ1dGU6IFhybS5BdHRyaWJ1dGVzLkRhdGVBdHRyaWJ1dGU7XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRGb3JtYXQoKTogWHJtLkF0dHJpYnV0ZXMuRGF0ZUF0dHJpYnV0ZUZvcm1hdCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEZvcm1hdCgpIGFzIFhybS5BdHRyaWJ1dGVzLkRhdGVBdHRyaWJ1dGVGb3JtYXQ7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IEF0dHJpYnV0ZSgpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYEZpZWxkICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9scygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IERhdGUge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpID8/IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgc2V0IFZhbHVlKHZhbHVlOiBEYXRlKSB7XHJcbiAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgQm9vbGVhbkZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5Cb29sZWFuQXR0cmlidXRlXHJcbiAgICB7XHJcbiAgICAgIHByb3RlY3RlZCBkZWNsYXJlIF9hdHRyaWJ1dGU6IFhybS5BdHRyaWJ1dGVzLkJvb2xlYW5BdHRyaWJ1dGU7XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRBdHRyaWJ1dGVUeXBlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRBdHRyaWJ1dGVUeXBlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0SW5pdGlhbFZhbHVlKCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRJbml0aWFsVmFsdWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCkgPz8gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBzZXQgVmFsdWUodmFsdWU6IGJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGV4cG9ydCBjbGFzcyBNdWx0aVNlbGVjdE9wdGlvblNldEZpZWxkPE9wdGlvbnMgZXh0ZW5kcyBPcHRpb25WYWx1ZXM+XHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5NdWx0aVNlbGVjdE9wdGlvblNldEF0dHJpYnV0ZVxyXG4gICAge1xyXG4gICAgICBwcm90ZWN0ZWQgZGVjbGFyZSBfYXR0cmlidXRlOiBYcm0uQXR0cmlidXRlcy5NdWx0aVNlbGVjdE9wdGlvblNldEF0dHJpYnV0ZTtcclxuICAgICAgT3B0aW9uOiBPcHRpb25zO1xyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGVOYW1lOiBzdHJpbmcsIG9wdGlvbj86IE9wdGlvbnMpIHtcclxuICAgICAgICBzdXBlcihhdHRyaWJ1dGVOYW1lKTtcclxuICAgICAgICB0aGlzLk9wdGlvbiA9IG9wdGlvbjtcclxuICAgICAgfVxyXG4gICAgICBnZXRGb3JtYXQoKTogWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlRm9ybWF0IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0Rm9ybWF0KCkgYXMgWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlRm9ybWF0O1xyXG4gICAgICB9XHJcbiAgICAgIGdldE9wdGlvbih2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogWHJtLk9wdGlvblNldFZhbHVlIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0T3B0aW9uKHZhbHVlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE9wdGlvbih2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGdldE9wdGlvbnMoKTogWHJtLk9wdGlvblNldFZhbHVlW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRPcHRpb25zKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0U2VsZWN0ZWRPcHRpb24oKTogWHJtLk9wdGlvblNldFZhbHVlW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRTZWxlY3RlZE9wdGlvbigpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFRleHQoKTogc3RyaW5nW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRUZXh0KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0SW5pdGlhbFZhbHVlKCk6IG51bWJlcltdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0SW5pdGlhbFZhbHVlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IEF0dHJpYnV0ZSgpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYEZpZWxkICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9scygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IG51bWJlcltdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXQgVmFsdWUodmFsdWU6IChrZXlvZiBPcHRpb25zKVtdIHwgbnVtYmVyW10pIHtcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICAgIGxldCB2YWx1ZXMgPSBbXTtcclxuICAgICAgICAgIHZhbHVlLmZvckVhY2goKHYpID0+IHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09IFwibnVtYmVyXCIpIHZhbHVlcy5wdXNoKHYpO1xyXG4gICAgICAgICAgICBlbHNlIHZhbHVlcy5wdXNoKHRoaXMuT3B0aW9uW3ZdKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWVzKTtcclxuICAgICAgICB9IGVsc2UgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgVmFsdWUgJyR7dmFsdWV9JyBpcyBub3QgYW4gQXJyYXlgKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIExvb2t1cEZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5Mb29rdXBBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuTG9va3VwQXR0cmlidXRlO1xyXG4gICAgICBwcm90ZWN0ZWQgX2N1c3RvbUZpbHRlcnM6IGFueSA9IFtdO1xyXG4gICAgICBwcm90ZWN0ZWQgX2lzRW50aXR5QXZhaWxhYmxlT2ZmbGluZTogYm9vbGVhbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuICAgICAgY29uc3RydWN0b3IoYXR0cmlidXRlOiBzdHJpbmcpIHtcclxuICAgICAgICBzdXBlcihhdHRyaWJ1dGUpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldElzUGFydHlMaXN0KCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRJc1BhcnR5TGlzdCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBBdHRyaWJ1dGUoKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9hdHRyaWJ1dGUgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldEF0dHJpYnV0ZSh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBGaWVsZCAnJHt0aGlzLk5hbWV9JyBkb2VzIG5vdCBleGlzdGApKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgY29udHJvbHMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmNvbnRyb2xzO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKkdldHMgdGhlIGlkIG9mIHRoZSBmaXJzdCBsb29rdXAgdmFsdWUqL1xyXG4gICAgICBnZXQgSWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVmFsdWUgJiYgdGhpcy5WYWx1ZS5sZW5ndGggPiAwXHJcbiAgICAgICAgICA/IFhybUV4Lm5vcm1hbGl6ZUd1aWQodGhpcy5WYWx1ZVswXS5pZClcclxuICAgICAgICAgIDogbnVsbDtcclxuICAgICAgfVxyXG4gICAgICAvKipHZXRzIHRoZSBlbnRpdHlUeXBlIG9mIHRoZSBmaXJzdCBsb29rdXAgdmFsdWUqL1xyXG4gICAgICBnZXQgRW50aXR5VHlwZSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5WYWx1ZSAmJiB0aGlzLlZhbHVlLmxlbmd0aCA+IDBcclxuICAgICAgICAgID8gdGhpcy5WYWx1ZVswXS5lbnRpdHlUeXBlXHJcbiAgICAgICAgICA6IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgLyoqR2V0cyB0aGUgZm9ybWF0dGVkIHZhbHVlIG9mIHRoZSBmaXJzdCBsb29rdXAgdmFsdWUqL1xyXG4gICAgICBnZXQgRm9ybWF0dGVkVmFsdWUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVmFsdWUgJiYgdGhpcy5WYWx1ZS5sZW5ndGggPiAwID8gdGhpcy5WYWx1ZVswXS5uYW1lIDogbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogWHJtLkxvb2t1cFZhbHVlW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpID8/IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgc2V0IFZhbHVlKHZhbHVlOiBYcm0uTG9va3VwVmFsdWVbXSkge1xyXG4gICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYSBsb29rdXBcclxuICAgICAgICogQHBhcmFtIGlkIEd1aWQgb2YgdGhlIHJlY29yZFxyXG4gICAgICAgKiBAcGFyYW0gZW50aXR5VHlwZSBsb2dpY2FsbmFtZSBvZiB0aGUgZW50aXR5XHJcbiAgICAgICAqIEBwYXJhbSBuYW1lIGZvcm1hdHRlZCB2YWx1ZVxyXG4gICAgICAgKiBAcGFyYW0gYXBwZW5kIGlmIHRydWUsIGFkZHMgdmFsdWUgdG8gdGhlIGFycmF5IGluc3RlYWQgb2YgcmVwbGFjaW5nIGl0XHJcbiAgICAgICAqL1xyXG4gICAgICBzZXRMb29rdXBWYWx1ZShcclxuICAgICAgICBpZDogc3RyaW5nLFxyXG4gICAgICAgIGVudGl0eVR5cGU6IGFueSxcclxuICAgICAgICBuYW1lOiBhbnksXHJcbiAgICAgICAgYXBwZW5kID0gZmFsc2VcclxuICAgICAgKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmICghaWQpIHRocm93IG5ldyBFcnJvcihgbm8gaWQgcGFyYW1ldGVyIHdhcyBwcm92aWRlZC5gKTtcclxuICAgICAgICAgIGlmICghZW50aXR5VHlwZSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBubyBlbnRpdHlUeXBlIHBhcmFtZXRlciB3YXMgcHJvdmlkZWQuYCk7XHJcbiAgICAgICAgICBpZCA9IFhybUV4Lm5vcm1hbGl6ZUd1aWQoaWQpO1xyXG4gICAgICAgICAgY29uc3QgbG9va3VwVmFsdWUgPSB7XHJcbiAgICAgICAgICAgIGlkLFxyXG4gICAgICAgICAgICBlbnRpdHlUeXBlLFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgfTtcclxuICAgICAgICAgIHRoaXMuVmFsdWUgPVxyXG4gICAgICAgICAgICBhcHBlbmQgJiYgdGhpcy5WYWx1ZVxyXG4gICAgICAgICAgICAgID8gdGhpcy5WYWx1ZS5jb25jYXQobG9va3VwVmFsdWUpXHJcbiAgICAgICAgICAgICAgOiBbbG9va3VwVmFsdWVdO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBTZXRzIGEgbG9va3VwIHdpdGggYSBsb29rdXAgZnJvbSB0aGUgcmV0cmlldmVkIHJlY29yZC5cclxuICAgICAgICogQHBhcmFtIHNlbGVjdE5hbWVcclxuICAgICAgICogQHBhcmFtIHJldHJpZXZlZFJlY29yZFxyXG4gICAgICAgKiBAZXhhbXBsZVxyXG4gICAgICAgKiB2YXIgY29udGFjdCA9IGF3YWl0IGZpZWxkcy5Db250YWN0LnJldHJpZXZlKCc/JHNlbGVjdD1fcGFyZW50Y3VzdG9tZXJpZF92YWx1ZScpO1xyXG4gICAgICAgKiBmaWVsZHMuQWNjb3VudC5zZXRMb29rdXBGcm9tUmV0cmlldmUoJ19wYXJlbnRjdXN0b21lcmlkX3ZhbHVlJywgY29udGFjdCk7XHJcbiAgICAgICAqIC8vQWx0ZXJuYXRlXHJcbiAgICAgICAqIGZpZWxkcy5BY2NvdW50LnNldExvb2t1cEZyb21SZXRyaWV2ZSgncGFyZW50Y3VzdG9tZXJpZCcsIGNvbnRhY3QpO1xyXG4gICAgICAgKi9cclxuICAgICAgc2V0TG9va3VwRnJvbVJldHJpZXZlKFxyXG4gICAgICAgIHNlbGVjdE5hbWU6IHN0cmluZyxcclxuICAgICAgICByZXRyaWV2ZWRSZWNvcmQ6IHsgW3g6IHN0cmluZ106IGFueSB9XHJcbiAgICAgICkge1xyXG4gICAgICAgIGlmICghc2VsZWN0TmFtZS5lbmRzV2l0aChcIl92YWx1ZVwiKSkgc2VsZWN0TmFtZSA9IGBfJHtzZWxlY3ROYW1lfV92YWx1ZWA7XHJcbiAgICAgICAgaWYgKCFyZXRyaWV2ZWRSZWNvcmQgfHwgIXJldHJpZXZlZFJlY29yZFtgJHtzZWxlY3ROYW1lfWBdKSB7XHJcbiAgICAgICAgICB0aGlzLlZhbHVlID0gbnVsbDtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5WYWx1ZSA9IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgaWQ6IHJldHJpZXZlZFJlY29yZFtgJHtzZWxlY3ROYW1lfWBdLFxyXG4gICAgICAgICAgICBlbnRpdHlUeXBlOlxyXG4gICAgICAgICAgICAgIHJldHJpZXZlZFJlY29yZFtcclxuICAgICAgICAgICAgICAgIGAke3NlbGVjdE5hbWV9QE1pY3Jvc29mdC5EeW5hbWljcy5DUk0ubG9va3VwbG9naWNhbG5hbWVgXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgbmFtZTogcmV0cmlldmVkUmVjb3JkW1xyXG4gICAgICAgICAgICAgIGAke3NlbGVjdE5hbWV9QE9EYXRhLkNvbW11bml0eS5EaXNwbGF5LlYxLkZvcm1hdHRlZFZhbHVlYFxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBSZXR1cm5zIG5hdGl2ZSBTREsgV2ViQXBpIGFwcHJvcHJpYXRlIGZvciB0aGUgY3VycmVudCBjbGllbnQgc3RhdGVcclxuICAgICAgICogQHJldHVybnMgWHJtLldlYkFwaU9mZmxpbmUgb3IgWHJtLldlYkFwaU9ubGluZVxyXG4gICAgICAgKi9cclxuICAgICAgZ2V0WHJtV2ViQXBpKCk6IFhybS5XZWJBcGlPZmZsaW5lIHwgWHJtLldlYkFwaU9ubGluZSB7XHJcbiAgICAgICAgaWYgKGlzT2ZmbGluZSgpID09PSB0cnVlKSB7XHJcbiAgICAgICAgICBpZiAodGhpcy5faXNFbnRpdHlBdmFpbGFibGVPZmZsaW5lID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5faXNFbnRpdHlBdmFpbGFibGVPZmZsaW5lID1cclxuICAgICAgICAgICAgICBYcm0uV2ViQXBpLm9mZmxpbmUuaXNBdmFpbGFibGVPZmZsaW5lKHRoaXMuRW50aXR5VHlwZSk7XHJcbiAgICAgICAgICAgIC8vIElmIHByb3BlcnR5IGlzIHN0aWxsIHVuZGVmaW5lZCBhdCB0aGlzIHBvaW50LCBzb21ldGhpbmcgaXNcclxuICAgICAgICAgICAgLy8gd3JvbmcuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc0VudGl0eUF2YWlsYWJsZU9mZmxpbmUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgIHRocm93RXJyb3IoXHJcbiAgICAgICAgICAgICAgICBcIlVuYWJsZSB0byBkZXRlcm1pbmUgb2ZmbGluZSBhdmFpbGFiaWxpdHkgZm9yIGVudGl0eTogXCIgK1xyXG4gICAgICAgICAgICAgICAgICB0aGlzLkVudGl0eVR5cGVcclxuICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBSZWN1cnNpdmUgY2FsbCB0byBzZWxmLCB2YWx1ZSBzaG91bGQgbm93IGJlIGVpdGhlciB0cnVlIG9yIGZhbHNlXHJcbiAgICAgICAgICAgIHRoaXMuZ2V0WHJtV2ViQXBpKCk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2lzRW50aXR5QXZhaWxhYmxlT2ZmbGluZSA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gWHJtLldlYkFwaS5vZmZsaW5lO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3dFcnJvcihcIlRoaXMgZW50aXR5IGlzIG5vdCBhdmFpbGFibGUgaW4gb2ZmbGluZSBtb2RlXCIpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gWHJtLldlYkFwaS5vbmxpbmU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBSZXRyaWV2ZXMgYW4gZW50aXR5IHJlY29yZC5cclxuICAgICAgICogQHBhcmFtIG9wdGlvbnMgKE9wdGlvbmFsKSBPRGF0YSBzeXN0ZW0gcXVlcnkgb3B0aW9ucywgJHNlbGVjdCBhbmQgJGV4cGFuZCwgdG8gcmV0cmlldmUgeW91ciBkYXRhLlxyXG4gICAgICAgKiAtIFVzZSB0aGUgJHNlbGVjdCBzeXN0ZW0gcXVlcnkgb3B0aW9uIHRvIGxpbWl0IHRoZSBwcm9wZXJ0aWVzIHJldHVybmVkIGJ5IGluY2x1ZGluZyBhIGNvbW1hLXNlcGFyYXRlZFxyXG4gICAgICAgKiAgIGxpc3Qgb2YgcHJvcGVydHkgbmFtZXMuIFRoaXMgaXMgYW4gaW1wb3J0YW50IHBlcmZvcm1hbmNlIGJlc3QgcHJhY3RpY2UuIElmIHByb3BlcnRpZXMgYXJlbuKAmXRcclxuICAgICAgICogICBzcGVjaWZpZWQgdXNpbmcgJHNlbGVjdCwgYWxsIHByb3BlcnRpZXMgd2lsbCBiZSByZXR1cm5lZC5cclxuICAgICAgICogLSBVc2UgdGhlICRleHBhbmQgc3lzdGVtIHF1ZXJ5IG9wdGlvbiB0byBjb250cm9sIHdoYXQgZGF0YSBmcm9tIHJlbGF0ZWQgZW50aXRpZXMgaXMgcmV0dXJuZWQuIElmIHlvdVxyXG4gICAgICAgKiAgIGp1c3QgaW5jbHVkZSB0aGUgbmFtZSBvZiB0aGUgbmF2aWdhdGlvbiBwcm9wZXJ0eSwgeW914oCZbGwgcmVjZWl2ZSBhbGwgdGhlIHByb3BlcnRpZXMgZm9yIHJlbGF0ZWRcclxuICAgICAgICogICByZWNvcmRzLiBZb3UgY2FuIGxpbWl0IHRoZSBwcm9wZXJ0aWVzIHJldHVybmVkIGZvciByZWxhdGVkIHJlY29yZHMgdXNpbmcgdGhlICRzZWxlY3Qgc3lzdGVtIHF1ZXJ5XHJcbiAgICAgICAqICAgb3B0aW9uIGluIHBhcmVudGhlc2VzIGFmdGVyIHRoZSBuYXZpZ2F0aW9uIHByb3BlcnR5IG5hbWUuIFVzZSB0aGlzIGZvciBib3RoIHNpbmdsZS12YWx1ZWQgYW5kXHJcbiAgICAgICAqICAgY29sbGVjdGlvbi12YWx1ZWQgbmF2aWdhdGlvbiBwcm9wZXJ0aWVzLlxyXG4gICAgICAgKiAtIFlvdSBjYW4gYWxzbyBzcGVjaWZ5IG11bHRpcGxlIHF1ZXJ5IG9wdGlvbnMgYnkgdXNpbmcgJiB0byBzZXBhcmF0ZSB0aGUgcXVlcnkgb3B0aW9ucy5cclxuICAgICAgICogQGV4YW1wbGUgPGNhcHRpb24+b3B0aW9ucyBleGFtcGxlOjwvY2FwdGlvbj5cclxuICAgICAgICogb3B0aW9uczogJHNlbGVjdD1uYW1lJiRleHBhbmQ9cHJpbWFyeWNvbnRhY3RpZCgkc2VsZWN0PWNvbnRhY3RpZCxmdWxsbmFtZSlcclxuICAgICAgICogQHJldHVybnMgT24gc3VjY2VzcywgcmV0dXJucyBhIHByb21pc2UgY29udGFpbmluZyBhIEpTT04gb2JqZWN0IHdpdGggdGhlIHJldHJpZXZlZCBhdHRyaWJ1dGVzIGFuZCB0aGVpciB2YWx1ZXMuXHJcbiAgICAgICAqIEBzZWUge0BsaW5rIGh0dHBzOi8vZG9jcy5taWNyb3NvZnQuY29tL2VuLXVzL2R5bmFtaWNzMzY1L2N1c3RvbWVyLWVuZ2FnZW1lbnQvZGV2ZWxvcGVyL2NsaWVudGFwaS9yZWZlcmVuY2UveHJtLXdlYmFwaS9yZXRyaWV2ZXJlY29yZCBFeHRlcm5hbCBMaW5rOiByZXRyaWV2ZVJlY29yZCAoQ2xpZW50IEFQSSByZWZlcmVuY2UpfVxyXG4gICAgICAgKi9cclxuICAgICAgYXN5bmMgcmV0cmlldmUob3B0aW9uczogc3RyaW5nKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmICghdGhpcy5JZCB8fCAhdGhpcy5FbnRpdHlUeXBlKSByZXR1cm4gbnVsbDtcclxuICAgICAgICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IFhybS5XZWJBcGkucmV0cmlldmVSZWNvcmQoXHJcbiAgICAgICAgICAgIHRoaXMuRW50aXR5VHlwZSxcclxuICAgICAgICAgICAgdGhpcy5JZCxcclxuICAgICAgICAgICAgb3B0aW9uc1xyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIHJldHVybiByZWNvcmQ7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBVcGRhdGVzIGFuIGVudGl0eSByZWNvcmQuXHJcbiAgICAgICAqIEBwYXJhbSBkYXRhIChyZXF1aXJlZCkgQSBKU09OIG9iamVjdCBjb250YWluaW5nIGtleSA6IHZhbHVlIHBhaXJzIHdoZXJlIGtleSBpcyB0aGUgYXR0cmlidXRlIG9mIHRoZSB0YWJsZVxyXG4gICAgICAgKiBhbmQgdmFsdWUgaXMgdGhlIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUgeW91IHdpc2ggdG8gdXBkYXRlLlxyXG4gICAgICAgKiBAZXhhbXBsZSA8Y2FwdGlvbj5kYXRhIGV4YW1wbGU6PC9jYXB0aW9uPlxyXG4gICAgICAgKiB2YXIgZGF0YSA9XHJcbiAgICAgICAqICAge1xyXG4gICAgICAgKiAgICAgXCJuYW1lXCI6IFwiVXBkYXRlZCBTYW1wbGUgQWNjb3VudCBcIixcclxuICAgICAgICogICAgIFwiY3JlZGl0b25ob2xkXCI6IHRydWUsXHJcbiAgICAgICAqICAgICBcImFkZHJlc3MxX2xhdGl0dWRlXCI6IDQ3LjYzOTU4MyxcclxuICAgICAgICogICAgIFwiZGVzY3JpcHRpb25cIjogXCJUaGlzIGlzIHRoZSB1cGRhdGVkIGRlc2NyaXB0aW9uIG9mIHRoZSBzYW1wbGUgYWNjb3VudFwiLFxyXG4gICAgICAgKiAgICAgXCJyZXZlbnVlXCI6IDYwMDAwMDAsXHJcbiAgICAgICAqICAgICBcImFjY291bnRjYXRlZ29yeWNvZGVcIjogMlxyXG4gICAgICAgKiAgIH07XHJcbiAgICAgICAqIEByZXR1cm5zIE9uIHN1Y2Nlc3MsIHJldHVybnMgYSBwcm9taXNlIG9iamVjdCB3aXRoIGVudGl0eVR5cGUgKHN0cmluZywgdGFibGUgbmFtZSkgYW5kIGlkIChzdHJpbmcsIEdVSUQgb2YgdGhlIHJlY29yZClcclxuICAgICAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9sZWFybi5taWNyb3NvZnQuY29tL2VuLXVzL3Bvd2VyLWFwcHMvZGV2ZWxvcGVyL21vZGVsLWRyaXZlbi1hcHBzL2NsaWVudGFwaS9yZWZlcmVuY2UveHJtLXdlYmFwaS91cGRhdGVyZWNvcmR9XHJcbiAgICAgICAqL1xyXG4gICAgICBhc3luYyB1cGRhdGUoZGF0YTogb2JqZWN0KTogUHJvbWlzZTxhbnk+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKCF0aGlzLklkIHx8ICF0aGlzLkVudGl0eVR5cGUgfHwgIWRhdGEpIHtcclxuICAgICAgICAgICAgdGhyb3dFcnJvcihcIk1pc3NpbmcgcmVxdWlyZWQgYXJndW1lbnRzIGZvciB1cGRhdGUgbWV0aG9kXCIpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0WHJtV2ViQXBpKCkudXBkYXRlUmVjb3JkKFxyXG4gICAgICAgICAgICB0aGlzLkVudGl0eVR5cGUsXHJcbiAgICAgICAgICAgIHRoaXMuSWQsXHJcbiAgICAgICAgICAgIGRhdGFcclxuICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEFkZHMgYW4gYWRkaXRpb25hbCBjdXN0b20gZmlsdGVyIHRvIHRoZSBsb29rdXAsIHdpdGggdGhlIFwiQU5EXCIgZmlsdGVyIG9wZXJhdG9yLlxyXG4gICAgICAgKiBAcGFyYW0gZmlsdGVyIFNwZWNpZmllcyB0aGUgZmlsdGVyLCBhcyBhIHNlcmlhbGl6ZWQgRmV0Y2hYTUwgXCJmaWx0ZXJcIiBub2RlLlxyXG4gICAgICAgKiBAcGFyYW0gZW50aXR5TG9naWNhbE5hbWUgKE9wdGlvbmFsKSBUaGUgbG9naWNhbCBuYW1lIG9mIHRoZSBlbnRpdHkuXHJcbiAgICAgICAqIEByZW1hcmtzICAgICBJZiBlbnRpdHlMb2dpY2FsTmFtZSBpcyBub3Qgc3BlY2lmaWVkLCB0aGUgZmlsdGVyIHdpbGwgYmUgYXBwbGllZCB0byBhbGwgZW50aXRpZXNcclxuICAgICAgICogICAgICAgICAgICAgIHZhbGlkIGZvciB0aGUgTG9va3VwIGNvbnRyb2wuXHJcbiAgICAgICAqIEBleGFtcGxlICAgICBFeGFtcGxlIGZpbHRlcjogPGZpbHRlciB0eXBlPVwiYW5kXCI+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGNvbmRpdGlvbiBhdHRyaWJ1dGU9XCJhZGRyZXNzMV9jaXR5XCIgb3BlcmF0b3I9XCJlcVwiIHZhbHVlPVwiUmVkbW9uZFwiIC8+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9maWx0ZXI+XHJcbiAgICAgICAqL1xyXG4gICAgICBhZGRQcmVGaWx0ZXJUb0xvb2t1cChcclxuICAgICAgICBmaWx0ZXJYbWw6IHN0cmluZyxcclxuICAgICAgICBlbnRpdHlMb2dpY2FsTmFtZT86IHN0cmluZ1xyXG4gICAgICApOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgX2FkZEN1c3RvbUZpbHRlci5jb250cm9scyA9IHRoaXMuY29udHJvbHM7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IHtcclxuICAgICAgICAgICAgY29udHJvbC5hZGRQcmVTZWFyY2goX2FkZEN1c3RvbUZpbHRlcik7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHRoaXMuX2N1c3RvbUZpbHRlcnMucHVzaChfYWRkQ3VzdG9tRmlsdGVyKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2FkZEN1c3RvbUZpbHRlcigpIHtcclxuICAgICAgICAgIF9hZGRDdXN0b21GaWx0ZXIuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZEN1c3RvbUZpbHRlcihmaWx0ZXJYbWwsIGVudGl0eUxvZ2ljYWxOYW1lKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogQWRkcyBhbiBhZGRpdGlvbmFsIGN1c3RvbSBmaWx0ZXIgdG8gdGhlIGxvb2t1cCwgd2l0aCB0aGUgXCJBTkRcIiBmaWx0ZXIgb3BlcmF0b3IuXHJcbiAgICAgICAqIEBwYXJhbSBlbnRpdHlMb2dpY2FsTmFtZSAoT3B0aW9uYWwpIFRoZSBsb2dpY2FsIG5hbWUgb2YgdGhlIGVudGl0eS5cclxuICAgICAgICogQHBhcmFtIHByaW1hcnlBdHRyaWJ1dGVJZE5hbWUgKE9wdGlvbmFsKSBUaGUgbG9naWNhbCBuYW1lIG9mIHRoZSBwcmltYXJ5IGtleS5cclxuICAgICAgICogQHBhcmFtIGZldGNoWG1sIFNwZWNpZmllcyB0aGUgRmV0Y2hYTUwgdXNlZCB0byBmaWx0ZXIuXHJcbiAgICAgICAqIEByZW1hcmtzICAgICBJZiBlbnRpdHlMb2dpY2FsTmFtZSBpcyBub3Qgc3BlY2lmaWVkLCB0aGUgZmlsdGVyIHdpbGwgYmUgYXBwbGllZCB0byBhbGwgZW50aXRpZXNcclxuICAgICAgICogICAgICAgICAgICAgIHZhbGlkIGZvciB0aGUgTG9va3VwIGNvbnRyb2wuXHJcbiAgICAgICAqIEBleGFtcGxlICAgICBFeGFtcGxlIGZldGNoWG1sOiA8ZmV0Y2g+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGVudGl0eSBuYW1lPVwiY29udGFjdFwiPlxyXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZmlsdGVyPlxyXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Y29uZGl0aW9uIGF0dHJpYnV0ZT1cImFkZHJlc3MxX2NpdHlcIiBvcGVyYXRvcj1cImVxXCIgdmFsdWU9XCJSZWRtb25kXCIgLz5cclxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9maWx0ZXI+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9lbnRpdHk+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9mZXRjaD5cclxuICAgICAgICovXHJcbiAgICAgIGFzeW5jIGFkZFByZUZpbHRlclRvTG9va3VwQWR2YW5jZWQoXHJcbiAgICAgICAgZW50aXR5TG9naWNhbE5hbWU6IHN0cmluZyxcclxuICAgICAgICBwcmltYXJ5QXR0cmlidXRlSWROYW1lOiBzdHJpbmcsXHJcbiAgICAgICAgZmV0Y2hYbWw6IHN0cmluZ1xyXG4gICAgICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgWHJtLldlYkFwaS5vbmxpbmUucmV0cmlldmVNdWx0aXBsZVJlY29yZHMoXHJcbiAgICAgICAgICAgIGVudGl0eUxvZ2ljYWxOYW1lLFxyXG4gICAgICAgICAgICBcIj9mZXRjaFhtbD1cIiArIGZldGNoWG1sXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgY29uc3QgZGF0YSA9IHJlc3VsdC5lbnRpdGllcztcclxuICAgICAgICAgIGxldCBmaWx0ZXJlZEVudGl0aWVzID0gXCJcIjtcclxuICAgICAgICAgIF9hZGRDdXN0b21GaWx0ZXIuY29udHJvbHMgPSB0aGlzLmNvbnRyb2xzO1xyXG4gICAgICAgICAgZGF0YS5mb3JFYWNoKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgIGZpbHRlcmVkRW50aXRpZXMgKz0gYDx2YWx1ZT4ke2l0ZW1bcHJpbWFyeUF0dHJpYnV0ZUlkTmFtZV19PC92YWx1ZT5gO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBmZXRjaFhtbCA9IGZpbHRlcmVkRW50aXRpZXNcclxuICAgICAgICAgICAgPyBgPGZpbHRlcj48Y29uZGl0aW9uIGF0dHJpYnV0ZT0nJHtwcmltYXJ5QXR0cmlidXRlSWROYW1lfScgb3BlcmF0b3I9J2luJz4ke2ZpbHRlcmVkRW50aXRpZXN9PC9jb25kaXRpb24+PC9maWx0ZXI+YFxyXG4gICAgICAgICAgICA6IGA8ZmlsdGVyPjxjb25kaXRpb24gYXR0cmlidXRlPScke3ByaW1hcnlBdHRyaWJ1dGVJZE5hbWV9JyBvcGVyYXRvcj0nbnVsbCcvPjwvZmlsdGVyPmA7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IHtcclxuICAgICAgICAgICAgY29udHJvbC5hZGRQcmVTZWFyY2goX2FkZEN1c3RvbUZpbHRlcik7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHRoaXMuX2N1c3RvbUZpbHRlcnMucHVzaChfYWRkQ3VzdG9tRmlsdGVyKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZnVuY3Rpb24gX2FkZEN1c3RvbUZpbHRlcigpIHtcclxuICAgICAgICAgIF9hZGRDdXN0b21GaWx0ZXIuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZEN1c3RvbUZpbHRlcihmZXRjaFhtbCwgZW50aXR5TG9naWNhbE5hbWUpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBSZW1vdmVzIGFsbCBmaWx0ZXJzIHNldCBvbiB0aGUgY3VycmVudCBsb29rdXAgYXR0cmlidXRlIGJ5IHVzaW5nIGFkZFByZUZpbHRlclRvTG9va3VwIG9yIGFkZFByZUZpbHRlclRvTG9va3VwQWR2YW5jZWRcclxuICAgICAgICovXHJcbiAgICAgIGNsZWFyUHJlRmlsdGVyRnJvbUxvb2t1cCgpOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgdGhpcy5fY3VzdG9tRmlsdGVycy5mb3JFYWNoKFxyXG4gICAgICAgICAgICAoY3VzdG9tRmlsdGVyOiBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy5jb250cm9scy5mb3JFYWNoKChjb250cm9sKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb250cm9sLnJlbW92ZVByZVNlYXJjaChjdXN0b21GaWx0ZXIpO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICB0eXBlIE9wdGlvblZhbHVlcyA9IHtcclxuICAgICAgW2tleTogc3RyaW5nXTogbnVtYmVyO1xyXG4gICAgfTtcclxuICAgIGV4cG9ydCBjbGFzcyBPcHRpb25zZXRGaWVsZDxPcHRpb25zIGV4dGVuZHMgT3B0aW9uVmFsdWVzPlxyXG4gICAgICBleHRlbmRzIEZpZWxkXHJcbiAgICAgIGltcGxlbWVudHMgWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlXHJcbiAgICB7XHJcbiAgICAgIHByb3RlY3RlZCBkZWNsYXJlIF9hdHRyaWJ1dGU6IFhybS5BdHRyaWJ1dGVzLk9wdGlvblNldEF0dHJpYnV0ZTtcclxuICAgICAgcHJvdGVjdGVkIF9jb250cm9sITogWHJtLkNvbnRyb2xzLk9wdGlvblNldENvbnRyb2w7XHJcbiAgICAgIE9wdGlvbjogT3B0aW9ucztcclxuICAgICAgY29uc3RydWN0b3IoYXR0cmlidXRlTmFtZTogc3RyaW5nLCBvcHRpb24/OiBPcHRpb25zKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlTmFtZSk7XHJcbiAgICAgICAgdGhpcy5PcHRpb24gPSBvcHRpb247XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Rm9ybWF0KCk6IFhybS5BdHRyaWJ1dGVzLk9wdGlvblNldEF0dHJpYnV0ZUZvcm1hdCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEZvcm1hdCgpIGFzIFhybS5BdHRyaWJ1dGVzLk9wdGlvblNldEF0dHJpYnV0ZUZvcm1hdDtcclxuICAgICAgfVxyXG4gICAgICBnZXRPcHRpb24odmFsdWU6IG51bWJlciB8IHN0cmluZyk6IFhybS5PcHRpb25TZXRWYWx1ZSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE9wdGlvbih2YWx1ZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRPcHRpb24odmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBnZXRPcHRpb25zKCk6IFhybS5PcHRpb25TZXRWYWx1ZVtdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0T3B0aW9ucygpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFNlbGVjdGVkT3B0aW9uKCk6IFhybS5PcHRpb25TZXRWYWx1ZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFNlbGVjdGVkT3B0aW9uKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VGV4dCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRUZXh0KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0SW5pdGlhbFZhbHVlKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEluaXRpYWxWYWx1ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBBdHRyaWJ1dGUoKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9hdHRyaWJ1dGUgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldEF0dHJpYnV0ZSh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBGaWVsZCAnJHt0aGlzLk5hbWV9JyBkb2VzIG5vdCBleGlzdGApKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgY29udHJvbHMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmNvbnRyb2xzO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9sKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fY29udHJvbCA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0Q29udHJvbCh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBDb250cm9sICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBWYWx1ZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZToga2V5b2YgT3B0aW9ucyB8IG51bWJlcikge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT0gXCJudW1iZXJcIikgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICAgIGVsc2UgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodGhpcy5PcHRpb25bdmFsdWVdKTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogQWRkcyBhbiBvcHRpb24uXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEBwYXJhbSB2YWx1ZXMgYW4gYXJyYXkgd2l0aCB0aGUgb3B0aW9uIHZhbHVlcyB0byBhZGRcclxuICAgICAgICogQHBhcmFtIGluZGV4IChPcHRpb25hbCkgemVyby1iYXNlZCBpbmRleCBvZiB0aGUgb3B0aW9uLlxyXG4gICAgICAgKlxyXG4gICAgICAgKiBAcmVtYXJrcyBUaGlzIG1ldGhvZCBkb2VzIG5vdCBjaGVjayB0aGF0IHRoZSB2YWx1ZXMgd2l0aGluIHRoZSBvcHRpb25zIHlvdSBhZGQgYXJlIHZhbGlkLlxyXG4gICAgICAgKiAgICAgICAgICBJZiBpbmRleCBpcyBub3QgcHJvdmlkZWQsIHRoZSBuZXcgb3B0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGVuZCBvZiB0aGUgbGlzdC5cclxuICAgICAgICovXHJcbiAgICAgIGFkZE9wdGlvbih2YWx1ZXM6IG51bWJlcltdLCBpbmRleD86IG51bWJlcik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWVzKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB2YWx1ZXMgaXMgbm90IGFuIEFycmF5OlxcbnZhbHVlczogJyR7dmFsdWVzfSdgKTtcclxuICAgICAgICAgIGNvbnN0IG9wdGlvblNldFZhbHVlcyA9XHJcbiAgICAgICAgICAgIHRoaXMuY29udHJvbC5nZXRBdHRyaWJ1dGUoKS5nZXRPcHRpb25zKCkgPz8gW107XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2Ygb3B0aW9uU2V0VmFsdWVzKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZXMuaW5jbHVkZXMoZWxlbWVudC52YWx1ZSkpIHtcclxuICAgICAgICAgICAgICB0aGlzLmNvbnRyb2wuYWRkT3B0aW9uKGVsZW1lbnQsIGluZGV4KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBSZW1vdmVzIHRoZSBvcHRpb24gbWF0Y2hpbmcgdGhlIHZhbHVlLlxyXG4gICAgICAgKlxyXG4gICAgICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlLlxyXG4gICAgICAgKi9cclxuICAgICAgcmVtb3ZlT3B0aW9uKHZhbHVlczogbnVtYmVyW10pOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlcykpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdmFsdWVzIGlzIG5vdCBhbiBBcnJheTpcXG52YWx1ZXM6ICcke3ZhbHVlc30nYCk7XHJcbiAgICAgICAgICBjb25zdCBvcHRpb25TZXRWYWx1ZXMgPVxyXG4gICAgICAgICAgICB0aGlzLmNvbnRyb2wuZ2V0QXR0cmlidXRlKCkuZ2V0T3B0aW9ucygpID8/IFtdO1xyXG4gICAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIG9wdGlvblNldFZhbHVlcykge1xyXG4gICAgICAgICAgICBpZiAodmFsdWVzLmluY2x1ZGVzKGVsZW1lbnQudmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5jb250cm9sLnJlbW92ZU9wdGlvbihlbGVtZW50LnZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBDbGVhcnMgYWxsIG9wdGlvbnMuXHJcbiAgICAgICAqL1xyXG4gICAgICBjbGVhck9wdGlvbnMoKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuY29udHJvbC5jbGVhck9wdGlvbnMoKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIFNlY3Rpb24gaW1wbGVtZW50cyBYcm0uQ29udHJvbHMuU2VjdGlvbiB7XHJcbiAgICAgIHB1YmxpYyByZWFkb25seSBOYW1lITogc3RyaW5nO1xyXG4gICAgICBwcm90ZWN0ZWQgX3NlY3Rpb24/OiBYcm0uQ29udHJvbHMuU2VjdGlvbjtcclxuICAgICAgcHVibGljIHBhcmVudFRhYj86IFhybS5Db250cm9scy5UYWI7XHJcbiAgICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuTmFtZSA9IG5hbWU7XHJcbiAgICAgIH1cclxuICAgICAgcHVibGljIGdldCBTZWN0aW9uKCk6IFhybS5Db250cm9scy5TZWN0aW9uIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX3NlY3Rpb24gPz89XHJcbiAgICAgICAgICB0aGlzLnBhcmVudFRhYi5zZWN0aW9ucy5nZXQodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihcclxuICAgICAgICAgICAgYFRoZSBzZWN0aW9uICcke3RoaXMuTmFtZX0nIHdhcyBub3QgZm91bmQgb24gdGhlIGZvcm0uYFxyXG4gICAgICAgICAgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uZ2V0TmFtZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFBhcmVudCgpOiBYcm0uQ29udHJvbHMuVGFiIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5TZWN0aW9uLmdldFBhcmVudCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnRyb2xzOiBYcm0uQ29sbGVjdGlvbi5JdGVtQ29sbGVjdGlvbjxYcm0uQ29udHJvbHMuQ29udHJvbD47XHJcbiAgICAgIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uc2V0VmlzaWJsZSh2aXNpYmxlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRWaXNpYmxlKCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uZ2V0VmlzaWJsZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldExhYmVsKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuU2VjdGlvbi5nZXRMYWJlbCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldExhYmVsKGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5TZWN0aW9uLnNldExhYmVsKGxhYmVsKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdHlwZSBUYWJTZWN0aW9ucyA9IHtcclxuICAgICAgW2tleTogc3RyaW5nXTogU2VjdGlvbjtcclxuICAgIH07XHJcbiAgICBleHBvcnQgY2xhc3MgVGFiPFNlY3Rpb25zIGV4dGVuZHMgVGFiU2VjdGlvbnM+IGltcGxlbWVudHMgWHJtLkNvbnRyb2xzLlRhYiB7XHJcbiAgICAgIHB1YmxpYyByZWFkb25seSBOYW1lITogc3RyaW5nO1xyXG4gICAgICBwcm90ZWN0ZWQgX3RhYj86IFhybS5Db250cm9scy5UYWI7XHJcbiAgICAgIFNlY3Rpb246IFNlY3Rpb25zO1xyXG4gICAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHNlY3Rpb24/OiBTZWN0aW9ucykge1xyXG4gICAgICAgIHRoaXMuTmFtZSA9IG5hbWU7XHJcbiAgICAgICAgdGhpcy5TZWN0aW9uID0gc2VjdGlvbjtcclxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gc2VjdGlvbikge1xyXG4gICAgICAgICAgc2VjdGlvbltrZXldLnBhcmVudFRhYiA9IHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGdldCBzZWN0aW9ucygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuc2VjdGlvbnM7XHJcbiAgICAgIH1cclxuICAgICAgcHVibGljIGdldCBUYWIoKTogWHJtLkNvbnRyb2xzLlRhYiB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl90YWIgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LnVpLnRhYnMuZ2V0KHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoXHJcbiAgICAgICAgICAgIGBUaGUgdGFiICcke3RoaXMuTmFtZX0nIHdhcyBub3QgZm91bmQgb24gdGhlIGZvcm0uYFxyXG4gICAgICAgICAgKSk7XHJcbiAgICAgIH1cclxuICAgICAgYWRkVGFiU3RhdGVDaGFuZ2UoaGFuZGxlcjogWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5hZGRUYWJTdGF0ZUNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgfVxyXG4gICAgICBnZXREaXNwbGF5U3RhdGUoKTogWHJtLkRpc3BsYXlTdGF0ZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLmdldERpc3BsYXlTdGF0ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldE5hbWUoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuZ2V0TmFtZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFBhcmVudCgpOiBYcm0uVWkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5nZXRQYXJlbnQoKTtcclxuICAgICAgfVxyXG4gICAgICByZW1vdmVUYWJTdGF0ZUNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLnJlbW92ZVRhYlN0YXRlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldERpc3BsYXlTdGF0ZShkaXNwbGF5U3RhdGU6IFhybS5EaXNwbGF5U3RhdGUpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuc2V0RGlzcGxheVN0YXRlKGRpc3BsYXlTdGF0ZSk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLnNldFZpc2libGUodmlzaWJsZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VmlzaWJsZSgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuZ2V0VmlzaWJsZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldExhYmVsKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLmdldExhYmVsKCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0TGFiZWwobGFiZWw6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5zZXRMYWJlbChsYWJlbCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0Rm9jdXMoKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLnNldEZvY3VzKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGV4cG9ydCBjbGFzcyBHcmlkQ29udHJvbCBpbXBsZW1lbnRzIFhybS5Db250cm9scy5HcmlkQ29udHJvbCB7XHJcbiAgICAgIHB1YmxpYyByZWFkb25seSBOYW1lITogc3RyaW5nO1xyXG4gICAgICBwcm90ZWN0ZWQgX2dyaWRDb250cm9sPzogWHJtLkNvbnRyb2xzLkdyaWRDb250cm9sO1xyXG4gICAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLk5hbWUgPSBuYW1lO1xyXG4gICAgICB9XHJcbiAgICAgIHB1YmxpYyBnZXQgR3JpZENvbnRyb2woKTogWHJtLkNvbnRyb2xzLkdyaWRDb250cm9sIHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgKHRoaXMuX2dyaWRDb250cm9sID8/PVxyXG4gICAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldENvbnRyb2w8WHJtLkNvbnRyb2xzLkdyaWRDb250cm9sPih0aGlzLk5hbWUpKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgVGhlIGdyaWQgJyR7dGhpcy5OYW1lfScgd2FzIG5vdCBmb3VuZCBvbiB0aGUgZm9ybS5gKVxyXG4gICAgICAgICk7XHJcbiAgICAgIH1cclxuICAgICAgcHVibGljIGdldCBHcmlkKCk6IFhybS5Db250cm9scy5HcmlkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5nZXRHcmlkKCk7XHJcbiAgICAgIH1cclxuICAgICAgYWRkT25Mb2FkKGhhbmRsZXI6IFhybS5FdmVudHMuR3JpZENvbnRyb2wuTG9hZEV2ZW50SGFuZGxlcik6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuR3JpZENvbnRyb2wucmVtb3ZlT25Mb2FkKGhhbmRsZXIgYXMgYW55KTtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5hZGRPbkxvYWQoaGFuZGxlcik7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Q29udGV4dFR5cGUoKTogWHJtRW51bS5HcmlkQ29udHJvbENvbnRleHQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldENvbnRleHRUeXBlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0RW50aXR5TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldEVudGl0eU5hbWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRGZXRjaFhtbCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldEZldGNoWG1sKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0R3JpZCgpOiBYcm0uQ29udHJvbHMuR3JpZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0R3JpZCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFJlbGF0aW9uc2hpcCgpOiBYcm0uQ29udHJvbHMuR3JpZFJlbGF0aW9uc2hpcCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0UmVsYXRpb25zaGlwKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VXJsKGNsaWVudD86IFhybUVudW0uR3JpZENsaWVudCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0VXJsKGNsaWVudCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Vmlld1NlbGVjdG9yKCk6IFhybS5Db250cm9scy5WaWV3U2VsZWN0b3Ige1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldFZpZXdTZWxlY3RvcigpO1xyXG4gICAgICB9XHJcbiAgICAgIG9wZW5SZWxhdGVkR3JpZCgpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5vcGVuUmVsYXRlZEdyaWQoKTtcclxuICAgICAgfVxyXG4gICAgICByZWZyZXNoKCk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnJlZnJlc2goKTtcclxuICAgICAgfVxyXG4gICAgICByZWZyZXNoUmliYm9uKCk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnJlZnJlc2hSaWJib24oKTtcclxuICAgICAgfVxyXG4gICAgICByZW1vdmVPbkxvYWQoaGFuZGxlcjogKCkgPT4gdm9pZCk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnJlbW92ZU9uTG9hZChoYW5kbGVyKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRDb250cm9sVHlwZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldENvbnRyb2xUeXBlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldE5hbWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRQYXJlbnQoKTogWHJtLkNvbnRyb2xzLlNlY3Rpb24ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldFBhcmVudCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldExhYmVsKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0TGFiZWwoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRMYWJlbChsYWJlbDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuc2V0TGFiZWwobGFiZWwpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFZpc2libGUoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0VmlzaWJsZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnNldFZpc2libGUodmlzaWJsZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19