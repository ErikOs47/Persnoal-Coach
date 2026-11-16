import sys, os, subprocess
from PIL import Image
raw, out = sys.argv[1], sys.argv[2]
M = """bb_squat Barbell_Squat
leg_press Leg_Press
hack_squat Hack_Squat
goblet_squat Goblet_Squat
bw_squat Bodyweight_Squat
front_squat Front_Barbell_Squat
rdl Romanian_Deadlift
db_rdl Stiff-Legged_Dumbbell_Deadlift
sl_rdl Kettlebell_One-Legged_Deadlift
deadlift Barbell_Deadlift
bulgarian Split_Squat_with_Dumbbells
walking_lunge Dumbbell_Lunges
step_up Dumbbell_Step_Ups
split_squat Split_Squats
leg_ext Leg_Extensions
lying_curl Lying_Leg_Curls
seated_curl Seated_Leg_Curl
nordic Natural_Glute_Ham_Raise
hip_thrust Barbell_Hip_Thrust
glute_bridge Single_Leg_Glute_Bridge
calf_machine Standing_Calf_Raises
db_calf Standing_Dumbbell_Calf_Raise
bench Barbell_Bench_Press_-_Medium_Grip
db_bench Dumbbell_Bench_Press
incline_db Incline_Dumbbell_Press
chest_press Machine_Bench_Press
pushup Pushups
dips Dips_-_Chest_Version
ohp Standing_Military_Press
db_ohp Seated_Dumbbell_Press
machine_shoulder Machine_Shoulder_Military_Press
bb_row Bent_Over_Barbell_Row
cable_row Seated_Cable_Rows
chest_row Dumbbell_Incline_Row
db_row One-Arm_Dumbbell_Row
inverted_row Inverted_Row
pullup Pullups
lat_pulldown Wide-Grip_Lat_Pulldown
chinup Chin-Up
cable_fly Cable_Crossover
pec_deck Butterfly
db_fly Dumbbell_Flyes
db_lateral Side_Lateral_Raise
cable_lateral Standing_Low-Pulley_Deltoid_Raise
band_lateral Lateral_Raise_-_With_Bands
face_pull Face_Pull
rear_fly Reverse_Flyes
pull_apart Band_Pull_Apart
db_curl Dumbbell_Bicep_Curl
bb_curl Barbell_Curl
cable_curl Standing_Biceps_Cable_Curl
hammer_curl Hammer_Curls
pushdown Triceps_Pushdown
oh_ext Standing_Dumbbell_Triceps_Extension
skull EZ-Bar_Skullcrusher
close_pushup Push-Ups_-_Close_Triceps_Position
cable_crunch Cable_Crunch
hanging_knee Hanging_Leg_Raise
dead_bug Dead_Bug
smith_squat Smith_Machine_Squat
box_squat Box_Squat
db_squat Dumbbell_Squat
good_morning Good_Morning
back_ext Hyperextensions_Back_Extensions
band_good_morning Band_Good_Morning
reverse_lunge Dumbbell_Rear_Lunge
standing_curl Standing_Leg_Curl
band_seated_curl Seated_Band_Hamstring_Curl
bb_glute_bridge Barbell_Glute_Bridge
hip_abduction Thigh_Abductor
cable_kickback One-Legged_Cable_Kickback
bw_glute_bridge Butt_Lift_Bridge
seated_calf Seated_Calf_Raise
legpress_calf Calf_Press_On_The_Leg_Press_Machine
band_calf Calf_Raises_-_With_Bands
incline_bb Barbell_Incline_Bench_Press_-_Medium_Grip
floor_press Dumbbell_Floor_Press
smith_bench Smith_Machine_Bench_Press
cable_press Cable_Chest_Press
incline_pushup Incline_Push-Up
decline_pushup Decline_Push-Up
arnold Arnold_Dumbbell_Press
standing_db_press Standing_Dumbbell_Press
band_ohp Shoulder_Press_-_With_Bands
tbar_row T-Bar_Row_with_Handle
machine_row Leverage_Iso_Row
db_bent_row Bent_Over_Two-Dumbbell_Row
close_pulldown V-Bar_Pulldown
underhand_pulldown Underhand_Cable_Pulldowns
straight_arm Straight-Arm_Pulldown
db_pullover Bent-Arm_Dumbbell_Pullover
incline_fly Incline_Dumbbell_Flyes
low_cable_fly Low_Cable_Crossover
band_fly Cross_Over_-_With_Bands
incline_lateral One-Arm_Incline_Lateral_Raise
cable_rear_fly Cable_Rear_Delt_Fly
machine_rear Reverse_Machine_Flyes
band_rear Back_Flyes_-_With_Bands
preacher_curl Preacher_Curl
incline_curl Incline_Dumbbell_Curl
concentration_curl Concentration_Curls
machine_curl Machine_Preacher_Curls
rope_pushdown Triceps_Pushdown_-_Rope_Attachment
cable_oh_ext Cable_Rope_Overhead_Triceps_Extension
bench_dip Bench_Dips
close_bench Close-Grip_Barbell_Bench_Press
reverse_crunch Reverse_Crunch
ab_machine Ab_Crunch_Machine
pallof Pallof_Press
crunch Crunches
decline_crunch Decline_Crunch"""
os.makedirs(out, exist_ok=True)
ok = []
for line in M.splitlines():
    k, src = line.split()
    good = True
    for i in (0, 1):
        p = f"{raw}/{src}_{i}.jpg"
        if not os.path.exists(p):
            subprocess.run(["curl", "-sS", "-f", "-m", "40", "-o", p, f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{src}/{i}.jpg"])
        try:
            im = Image.open(p).convert("RGB"); im.thumbnail((480, 480)); im.save(f"{out}/{k}-{i}.webp", quality=68, method=6)
        except Exception as e:
            good = False; print("FAIL", k, src, e)
    if good: ok.append(k)
print(len(ok), "ok"); print(",".join(ok))
