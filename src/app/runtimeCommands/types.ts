import type { Operation as EffectionOperation } from 'effection';
import type { RuntimeScopeKind } from '../../effects/scope';
import type { AppNotificationSeverity } from '../../state/appNotifications.slice';
import type {
    OperationKind,
    OperationRouteLink,
} from '../../state/operations.slice';
import type { PayloadDetailRecord } from '../../state/payloadDetails';
import type { RootState } from '../../state/store';

/**
 * Per-call workflow controls used by route loaders/actions.
 */
export interface WorkflowRunOptions {
    /** Abort signal from React Router request or caller-owned cancellation. */
    signal?: AbortSignal;
    /** Stable id for operation tracking; generated when omitted. */
    requestId?: string;
    /** User-facing pending label stored in the operations slice. */
    label?: string;
    /** Machine-readable operation category for diagnostics. */
    kind?: OperationKind;
    /** Effection scope lifetime for the launched workflow. */
    scope?: RuntimeScopeKind;
    /** Whether to write operation lifecycle records into Redux. */
    track?: boolean;
}

/**
 * User-facing completion copy attached to a background operation outcome.
 */
export interface OperationNotificationTemplate {
    title: string;
    message: string;
    severity?: AppNotificationSeverity;
}

/**
 * Runtime-owned metadata for one non-blocking Effection workflow.
 *
 * The workflow file owns Signify/KERIA behavior; these options describe how the
 * shell should track, de-duplicate, link, announce, and enrich that work.
 */
export interface BackgroundWorkflowRunOptions<T = unknown> {
    requestId?: string;
    label: string;
    title?: string;
    description?: string | null;
    kind: OperationKind;
    scope?: RuntimeScopeKind;
    resourceKeys?: readonly string[];
    resultRoute?: OperationRouteLink | null;
    successNotification?: OperationNotificationTemplate;
    failureNotification?: OperationNotificationTemplate;
    payloadDetails?: (result: T, state: RootState) => PayloadDetailRecord[];
}

/**
 * Immediate route-action result from a background workflow launch.
 *
 * Route actions return this instead of waiting for KERIA, which lets the UI
 * navigate while operation records and app notifications carry progress.
 */
export type BackgroundWorkflowStartResult =
    | {
          status: 'accepted';
          requestId: string;
          operationRoute: string;
      }
    | {
          status: 'conflict';
          requestId: string;
          operationRoute: string;
          message: string;
      };

/**
 * Narrow capability surface command modules may use.
 *
 * Commands build runtime metadata and launch workflows. They do not own Redux
 * dispatch, raw Signify calls, connection state, or Effection task handles.
 */
export interface RuntimeCommandContext {
    runWorkflow<T>(
        operation: () => EffectionOperation<T>,
        options?: WorkflowRunOptions
    ): Promise<T>;
    startBackgroundWorkflow<T>(
        operation: () => EffectionOperation<T>,
        options: BackgroundWorkflowRunOptions<T>
    ): BackgroundWorkflowStartResult;
    createRequestId(): string;
    getState(): RootState;
}

export type RequestIdOptions = Pick<WorkflowRunOptions, 'requestId'>;
export type RequestSignalOptions = Pick<
    WorkflowRunOptions,
    'requestId' | 'signal'
>;
