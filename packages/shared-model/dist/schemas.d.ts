import { z } from 'zod';
export declare const cadenceUnitSchema: z.ZodEnum<["day", "week", "month"]>;
export declare const standardCadenceSchema: z.ZodObject<{
    interval: z.ZodNumber;
    unit: z.ZodEnum<["day", "week", "month"]>;
}, "strip", z.ZodTypeAny, {
    interval: number;
    unit: "day" | "week" | "month";
}, {
    interval: number;
    unit: "day" | "week" | "month";
}>;
export declare const legacyStandardCadenceSchema: z.ZodUnion<[z.ZodLiteral<"daily">, z.ZodLiteral<"weekly">, z.ZodLiteral<"monthly">]>;
export declare const standardStateSchema: z.ZodUnion<[z.ZodLiteral<"active">, z.ZodLiteral<"archived">]>;
export declare const standardSessionConfigSchema: z.ZodObject<{
    sessionLabel: z.ZodString;
    sessionsPerCadence: z.ZodNumber;
    volumePerSession: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sessionLabel: string;
    sessionsPerCadence: number;
    volumePerSession: number;
}, {
    sessionLabel: string;
    sessionsPerCadence: number;
    volumePerSession: number;
}>;
export declare const activitySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    unit: z.ZodEffects<z.ZodString, string, string>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    updatedAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    deletedAtMs: z.ZodNullable<z.ZodEffects<z.ZodNumber, number, number>>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    id: string;
    name: string;
    notes: string | null;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
}, {
    unit: string;
    id: string;
    name: string;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
    notes?: string | null | undefined;
}>;
export declare const configEraSchema: z.ZodObject<{
    effectiveFromMs: z.ZodEffects<z.ZodNumber, number, number>;
    minimum: z.ZodNumber;
    unit: z.ZodString;
    cadence: z.ZodObject<{
        interval: z.ZodNumber;
        unit: z.ZodEnum<["day", "week", "month"]>;
    }, "strip", z.ZodTypeAny, {
        interval: number;
        unit: "day" | "week" | "month";
    }, {
        interval: number;
        unit: "day" | "week" | "month";
    }>;
    sessionConfig: z.ZodObject<{
        sessionLabel: z.ZodString;
        sessionsPerCadence: z.ZodNumber;
        volumePerSession: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    }, {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    }>;
    summary: z.ZodString;
    periodStartPreference: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"default">;
    }, "strip", z.ZodTypeAny, {
        mode: "default";
    }, {
        mode: "default";
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"weekDay">;
        weekStartDay: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        mode: "weekDay";
        weekStartDay: number;
    }, {
        mode: "weekDay";
        weekStartDay: number;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    minimum: number;
    effectiveFromMs: number;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    summary: string;
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
}, {
    unit: string;
    minimum: number;
    effectiveFromMs: number;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    summary: string;
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
}>;
export declare const standardSchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodDefault<z.ZodString>;
    minimum: z.ZodNumber;
    unit: z.ZodEffects<z.ZodString, string, string>;
    cadence: z.ZodObject<{
        interval: z.ZodNumber;
        unit: z.ZodEnum<["day", "week", "month"]>;
    }, "strip", z.ZodTypeAny, {
        interval: number;
        unit: "day" | "week" | "month";
    }, {
        interval: number;
        unit: "day" | "week" | "month";
    }>;
    state: z.ZodUnion<[z.ZodLiteral<"active">, z.ZodLiteral<"archived">]>;
    summary: z.ZodString;
    archivedAtMs: z.ZodNullable<z.ZodEffects<z.ZodNumber, number, number>>;
    defaultQuantity: z.ZodOptional<z.ZodNumber>;
    sessionConfig: z.ZodObject<{
        sessionLabel: z.ZodString;
        sessionsPerCadence: z.ZodNumber;
        volumePerSession: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    }, {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    }>;
    periodStartPreference: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"default">;
    }, "strip", z.ZodTypeAny, {
        mode: "default";
    }, {
        mode: "default";
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"weekDay">;
        weekStartDay: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        mode: "weekDay";
        weekStartDay: number;
    }, {
        mode: "weekDay";
        weekStartDay: number;
    }>]>>;
    configEras: z.ZodOptional<z.ZodArray<z.ZodObject<{
        effectiveFromMs: z.ZodEffects<z.ZodNumber, number, number>;
        minimum: z.ZodNumber;
        unit: z.ZodString;
        cadence: z.ZodObject<{
            interval: z.ZodNumber;
            unit: z.ZodEnum<["day", "week", "month"]>;
        }, "strip", z.ZodTypeAny, {
            interval: number;
            unit: "day" | "week" | "month";
        }, {
            interval: number;
            unit: "day" | "week" | "month";
        }>;
        sessionConfig: z.ZodObject<{
            sessionLabel: z.ZodString;
            sessionsPerCadence: z.ZodNumber;
            volumePerSession: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        }, {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        }>;
        summary: z.ZodString;
        periodStartPreference: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
            mode: z.ZodLiteral<"default">;
        }, "strip", z.ZodTypeAny, {
            mode: "default";
        }, {
            mode: "default";
        }>, z.ZodObject<{
            mode: z.ZodLiteral<"weekDay">;
            weekStartDay: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            mode: "weekDay";
            weekStartDay: number;
        }, {
            mode: "weekDay";
            weekStartDay: number;
        }>]>>;
    }, "strip", z.ZodTypeAny, {
        unit: string;
        minimum: number;
        effectiveFromMs: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        summary: string;
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
    }, {
        unit: string;
        minimum: number;
        effectiveFromMs: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        summary: string;
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
    }>, "many">>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    orderIndex: z.ZodOptional<z.ZodNumber>;
    dashboardPageId: z.ZodOptional<z.ZodString>;
    dashboardOrderIndex: z.ZodOptional<z.ZodNumber>;
    hiddenFromGroup: z.ZodOptional<z.ZodBoolean>;
    activityId: z.ZodOptional<z.ZodString>;
    createdAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    updatedAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    deletedAtMs: z.ZodNullable<z.ZodEffects<z.ZodNumber, number, number>>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    minimum: number;
    id: string;
    name: string;
    notes: string | null;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    summary: string;
    state: "active" | "archived";
    archivedAtMs: number | null;
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
    defaultQuantity?: number | undefined;
    configEras?: {
        unit: string;
        minimum: number;
        effectiveFromMs: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        summary: string;
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
    }[] | undefined;
    orderIndex?: number | undefined;
    dashboardPageId?: string | undefined;
    dashboardOrderIndex?: number | undefined;
    hiddenFromGroup?: boolean | undefined;
    activityId?: string | undefined;
}, {
    unit: string;
    minimum: number;
    id: string;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    summary: string;
    state: "active" | "archived";
    archivedAtMs: number | null;
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
    name?: string | undefined;
    notes?: string | null | undefined;
    defaultQuantity?: number | undefined;
    configEras?: {
        unit: string;
        minimum: number;
        effectiveFromMs: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        summary: string;
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
    }[] | undefined;
    orderIndex?: number | undefined;
    dashboardPageId?: string | undefined;
    dashboardOrderIndex?: number | undefined;
    hiddenFromGroup?: boolean | undefined;
    activityId?: string | undefined;
}>, {
    unit: string;
    minimum: number;
    id: string;
    name: string;
    notes: string | null;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    summary: string;
    state: "active" | "archived";
    archivedAtMs: number | null;
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
    defaultQuantity?: number | undefined;
    configEras?: {
        unit: string;
        minimum: number;
        effectiveFromMs: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        summary: string;
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
    }[] | undefined;
    orderIndex?: number | undefined;
    dashboardPageId?: string | undefined;
    dashboardOrderIndex?: number | undefined;
    hiddenFromGroup?: boolean | undefined;
    activityId?: string | undefined;
}, {
    unit: string;
    minimum: number;
    id: string;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    summary: string;
    state: "active" | "archived";
    archivedAtMs: number | null;
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
    name?: string | undefined;
    notes?: string | null | undefined;
    defaultQuantity?: number | undefined;
    configEras?: {
        unit: string;
        minimum: number;
        effectiveFromMs: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        summary: string;
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
    }[] | undefined;
    orderIndex?: number | undefined;
    dashboardPageId?: string | undefined;
    dashboardOrderIndex?: number | undefined;
    hiddenFromGroup?: boolean | undefined;
    activityId?: string | undefined;
}>;
export declare const activityLogSchema: z.ZodObject<{
    id: z.ZodString;
    standardId: z.ZodString;
    value: z.ZodNumber;
    occurredAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    note: z.ZodNullable<z.ZodString>;
    editedAtMs: z.ZodNullable<z.ZodEffects<z.ZodNumber, number, number>>;
    createdAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    updatedAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    deletedAtMs: z.ZodNullable<z.ZodEffects<z.ZodNumber, number, number>>;
}, "strip", z.ZodTypeAny, {
    value: number;
    id: string;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
    standardId: string;
    occurredAtMs: number;
    note: string | null;
    editedAtMs: number | null;
}, {
    value: number;
    id: string;
    createdAtMs: number;
    updatedAtMs: number;
    deletedAtMs: number | null;
    standardId: string;
    occurredAtMs: number;
    note: string | null;
    editedAtMs: number | null;
}>;
export declare const dashboardLayoutPageSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    orderIndex: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    orderIndex: number;
}, {
    id: string;
    name: string;
    orderIndex: number;
}>;
export declare const dashboardLayoutSchema: z.ZodObject<{
    id: z.ZodString;
    pages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        orderIndex: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        orderIndex: number;
    }, {
        id: string;
        name: string;
        orderIndex: number;
    }>, "many">;
    pageSize: z.ZodLiteral<6>;
    updatedAtMs: z.ZodEffects<z.ZodNumber, number, number>;
}, "strip", z.ZodTypeAny, {
    id: string;
    updatedAtMs: number;
    pages: {
        id: string;
        name: string;
        orderIndex: number;
    }[];
    pageSize: 6;
}, {
    id: string;
    updatedAtMs: number;
    pages: {
        id: string;
        name: string;
        orderIndex: number;
    }[];
    pageSize: 6;
}>;
export type ActivitySchema = z.infer<typeof activitySchema>;
export type StandardSchema = z.infer<typeof standardSchema>;
export type ActivityLogSchema = z.infer<typeof activityLogSchema>;
export type DashboardPinsSchema = z.infer<typeof dashboardPinsSchema>;
export declare const dashboardPinsSchema: z.ZodObject<{
    id: z.ZodString;
    pinnedStandardIds: z.ZodArray<z.ZodString, "many">;
    updatedAtMs: z.ZodEffects<z.ZodNumber, number, number>;
}, "strip", z.ZodTypeAny, {
    id: string;
    updatedAtMs: number;
    pinnedStandardIds: string[];
}, {
    id: string;
    updatedAtMs: number;
    pinnedStandardIds: string[];
}>;
export declare const activityHistorySourceSchema: z.ZodEnum<["boundary", "resume", "log-edit"]>;
export declare const activityHistoryStandardSnapshotSchema: z.ZodObject<{
    minimum: z.ZodNumber;
    unit: z.ZodString;
    cadence: z.ZodObject<{
        interval: z.ZodNumber;
        unit: z.ZodEnum<["day", "week", "month"]>;
    }, "strip", z.ZodTypeAny, {
        interval: number;
        unit: "day" | "week" | "month";
    }, {
        interval: number;
        unit: "day" | "week" | "month";
    }>;
    sessionConfig: z.ZodObject<{
        sessionLabel: z.ZodString;
        sessionsPerCadence: z.ZodNumber;
        volumePerSession: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    }, {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    }>;
    summary: z.ZodOptional<z.ZodString>;
    periodStartPreference: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"default">;
    }, "strip", z.ZodTypeAny, {
        mode: "default";
    }, {
        mode: "default";
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"weekDay">;
        weekStartDay: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        mode: "weekDay";
        weekStartDay: number;
    }, {
        mode: "weekDay";
        weekStartDay: number;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    minimum: number;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
    summary?: string | undefined;
}, {
    unit: string;
    minimum: number;
    cadence: {
        interval: number;
        unit: "day" | "week" | "month";
    };
    sessionConfig: {
        sessionLabel: string;
        sessionsPerCadence: number;
        volumePerSession: number;
    };
    periodStartPreference?: {
        mode: "default";
    } | {
        mode: "weekDay";
        weekStartDay: number;
    } | undefined;
    summary?: string | undefined;
}>;
export declare const activityHistoryPeriodStatusSchema: z.ZodEnum<["Met", "In Progress", "Missed"]>;
export declare const activityHistoryDocSchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    standardId: z.ZodString;
    activityId: z.ZodOptional<z.ZodString>;
    referenceTimestampMs: z.ZodEffects<z.ZodNumber, number, number>;
    standardSnapshot: z.ZodObject<{
        minimum: z.ZodNumber;
        unit: z.ZodString;
        cadence: z.ZodObject<{
            interval: z.ZodNumber;
            unit: z.ZodEnum<["day", "week", "month"]>;
        }, "strip", z.ZodTypeAny, {
            interval: number;
            unit: "day" | "week" | "month";
        }, {
            interval: number;
            unit: "day" | "week" | "month";
        }>;
        sessionConfig: z.ZodObject<{
            sessionLabel: z.ZodString;
            sessionsPerCadence: z.ZodNumber;
            volumePerSession: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        }, {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        }>;
        summary: z.ZodOptional<z.ZodString>;
        periodStartPreference: z.ZodOptional<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
            mode: z.ZodLiteral<"default">;
        }, "strip", z.ZodTypeAny, {
            mode: "default";
        }, {
            mode: "default";
        }>, z.ZodObject<{
            mode: z.ZodLiteral<"weekDay">;
            weekStartDay: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            mode: "weekDay";
            weekStartDay: number;
        }, {
            mode: "weekDay";
            weekStartDay: number;
        }>]>>;
    }, "strip", z.ZodTypeAny, {
        unit: string;
        minimum: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
        summary?: string | undefined;
    }, {
        unit: string;
        minimum: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
        summary?: string | undefined;
    }>;
    total: z.ZodNumber;
    currentSessions: z.ZodNumber;
    targetSessions: z.ZodNumber;
    status: z.ZodEnum<["Met", "In Progress", "Missed"]>;
    progressPercent: z.ZodNumber;
    generatedAtMs: z.ZodEffects<z.ZodNumber, number, number>;
    source: z.ZodEnum<["boundary", "resume", "log-edit"]>;
    deletedAtMs: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodNumber, number, number>>>;
    periodStartMs: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    periodEndMs: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    periodLabel: z.ZodOptional<z.ZodString>;
    periodKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "Met" | "In Progress" | "Missed";
    id: string;
    standardId: string;
    referenceTimestampMs: number;
    standardSnapshot: {
        unit: string;
        minimum: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
        summary?: string | undefined;
    };
    total: number;
    currentSessions: number;
    targetSessions: number;
    progressPercent: number;
    generatedAtMs: number;
    source: "boundary" | "resume" | "log-edit";
    deletedAtMs?: number | null | undefined;
    activityId?: string | undefined;
    periodStartMs?: number | undefined;
    periodEndMs?: number | undefined;
    periodLabel?: string | undefined;
    periodKey?: string | undefined;
}, {
    status: "Met" | "In Progress" | "Missed";
    id: string;
    standardId: string;
    referenceTimestampMs: number;
    standardSnapshot: {
        unit: string;
        minimum: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
        summary?: string | undefined;
    };
    total: number;
    currentSessions: number;
    targetSessions: number;
    progressPercent: number;
    generatedAtMs: number;
    source: "boundary" | "resume" | "log-edit";
    deletedAtMs?: number | null | undefined;
    activityId?: string | undefined;
    periodStartMs?: number | undefined;
    periodEndMs?: number | undefined;
    periodLabel?: string | undefined;
    periodKey?: string | undefined;
}>, {
    status: "Met" | "In Progress" | "Missed";
    id: string;
    standardId: string;
    referenceTimestampMs: number;
    standardSnapshot: {
        unit: string;
        minimum: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
        summary?: string | undefined;
    };
    total: number;
    currentSessions: number;
    targetSessions: number;
    progressPercent: number;
    generatedAtMs: number;
    source: "boundary" | "resume" | "log-edit";
    deletedAtMs?: number | null | undefined;
    activityId?: string | undefined;
    periodStartMs?: number | undefined;
    periodEndMs?: number | undefined;
    periodLabel?: string | undefined;
    periodKey?: string | undefined;
}, {
    status: "Met" | "In Progress" | "Missed";
    id: string;
    standardId: string;
    referenceTimestampMs: number;
    standardSnapshot: {
        unit: string;
        minimum: number;
        cadence: {
            interval: number;
            unit: "day" | "week" | "month";
        };
        sessionConfig: {
            sessionLabel: string;
            sessionsPerCadence: number;
            volumePerSession: number;
        };
        periodStartPreference?: {
            mode: "default";
        } | {
            mode: "weekDay";
            weekStartDay: number;
        } | undefined;
        summary?: string | undefined;
    };
    total: number;
    currentSessions: number;
    targetSessions: number;
    progressPercent: number;
    generatedAtMs: number;
    source: "boundary" | "resume" | "log-edit";
    deletedAtMs?: number | null | undefined;
    activityId?: string | undefined;
    periodStartMs?: number | undefined;
    periodEndMs?: number | undefined;
    periodLabel?: string | undefined;
    periodKey?: string | undefined;
}>;
export type ActivityHistoryDocSchema = z.infer<typeof activityHistoryDocSchema>;
