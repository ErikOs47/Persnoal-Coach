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
plank Plank"""
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
